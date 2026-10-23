import { AppError } from "@/lib/app-error";
import { GOALS, type Goal } from "@/lib/labels";
import { sumEntries, rescale, type Totals } from "@/lib/nutrition/day";
import type { MealSlot } from "@/lib/nutrition/labels";
import { nutritionAnswersSchema, type NutritionAnswers } from "@/lib/nutrition/schema";
import { calorieTarget, type Target } from "@/lib/nutrition/target";
import { sofiaToday } from "@/lib/progress-photos/today";
import type { TypedClient } from "@/server/db/types";

export type FoodEntry = {
  id: string;
  eatenOn: string;
  meal: MealSlot;
  name: string;
  grams: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: "ai" | "manual" | "recent" | "menu";
};

export type FoodItem = {
  name: string;
  grams: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BATCH_KEY = /food_entries_user_id_batch_id_position_key/;
const PAGE = 1000;
const MAX_ITEMS = 100;
const RECENT_SCAN = 300;

const ENTRY_COLUMNS = "id, eaten_on, meal, name, grams, kcal, protein_g, carbs_g, fat_g, source";

type EntryRow = {
  id: string;
  eaten_on: string;
  meal: MealSlot;
  name: string;
  grams: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  source: FoodEntry["source"];
};

function toEntry(r: EntryRow): FoodEntry {
  return {
    id: r.id,
    eatenOn: r.eaten_on,
    meal: r.meal,
    name: r.name,
    grams: r.grams,
    kcal: r.kcal,
    proteinG: r.protein_g,
    carbsG: r.carbs_g,
    fatG: r.fat_g,
    source: r.source,
  };
}

/** Calendar arithmetic on a YYYY-MM-DD string (no time zone involved). */
function addDays(day: string, offset: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** The day's entries in the order they were added, with their totals. RLS limits this to her own. */
export async function getDiaryDay(
  db: TypedClient,
  userId: string,
  day: string,
): Promise<{ entries: FoodEntry[]; totals: Totals }> {
  const { data, error } = await db
    .from("food_entries")
    .select(ENTRY_COLUMNS)
    .eq("user_id", userId)
    .eq("eaten_on", day)
    .order("created_at")
    .order("position")
    .order("id")
    .limit(MAX_ITEMS);
  if (error) throw new Error(`load diary day failed: ${error.message}`);
  const entries = data.map(toEntry);
  return { entries, totals: sumEntries(entries) };
}

/**
 * Saves the items of one add flow in a single insert. Position within the batch plus the batch id make a
 * retried request conflict instead of doubling the day; that conflict counts as success.
 */
export async function addEntries(
  db: TypedClient,
  userId: string,
  input: {
    day: string;
    meal: MealSlot;
    batchId: string;
    source: FoodEntry["source"];
    items: FoodItem[];
  },
): Promise<void> {
  if (input.items.length === 0) return;
  if (input.items.length > MAX_ITEMS || !DAY.test(input.day) || !UUID.test(input.batchId)) {
    throw new AppError("INVALID", "Невалидни данни за записа.");
  }
  const rows = input.items.map((item, position) => ({
    user_id: userId,
    batch_id: input.batchId,
    position,
    eaten_on: input.day,
    meal: input.meal,
    source: input.source,
    name: item.name.trim(),
    grams: item.grams,
    kcal: Math.round(item.kcal),
    protein_g: item.proteinG,
    carbs_g: item.carbsG,
    fat_g: item.fatG,
  }));
  const { error } = await db.from("food_entries").insert(rows);
  if (!error) return;
  // Same batch sent twice (double tap, retry after a lost response): already saved. Only that unique key
  // counts; any other unique violation is a real failure.
  if (error.code === "23505" && BATCH_KEY.test(`${error.message} ${error.details ?? ""}`)) return;
  // Date window (22023) and daily cap (P0001): the trigger's Bulgarian message is meant for her. A retry
  // of a batch that is already saved can hit these too (the first attempt filled the day to 100, or the
  // retry crossed midnight at the 365-day edge), so a fully saved batch is still a success.
  if (error.code === "22023" || error.code === "P0001") {
    const saved = await db
      .from("food_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("batch_id", input.batchId);
    if (!saved.error && saved.count === rows.length) return;
    throw new AppError("INVALID", error.message);
  }
  if (error.code === "42501") {
    throw new AppError("FORBIDDEN", "Записването е достъпно с активен план.");
  }
  if (error.code === "23514" || error.code === "22P02" || error.code === "22003") {
    throw new AppError("INVALID", "Невалидни стойности.");
  }
  throw new Error(`add food entries failed: ${error.message}`);
}

/** Changes the amount and scales kcal and macros linearly from the stored row. */
export async function updateEntryGrams(db: TypedClient, id: string, grams: number): Promise<void> {
  if (!UUID.test(id)) throw new AppError("NOT_FOUND", "Записът не е намерен.");
  const { data: row, error } = await db
    .from("food_entries")
    .select("name, grams, kcal, protein_g, carbs_g, fat_g")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`load food entry failed: ${error.message}`);
  if (!row) throw new AppError("NOT_FOUND", "Записът не е намерен.");

  const scaled =
    row.grams === null
      ? null
      : rescale(
          {
            name: row.name,
            grams: row.grams,
            kcal: row.kcal,
            proteinG: row.protein_g,
            carbsG: row.carbs_g,
            fatG: row.fat_g,
          },
          grams,
        );
  if (!scaled) throw new AppError("INVALID", "Количеството е извън допустимото.");

  const { data: changed, error: updateError } = await db
    .from("food_entries")
    .update({
      grams: scaled.grams,
      kcal: scaled.kcal,
      protein_g: scaled.proteinG,
      carbs_g: scaled.carbsG,
      fat_g: scaled.fatG,
    })
    .eq("id", id)
    .select("id");
  if (updateError) throw new Error(`update food entry failed: ${updateError.message}`);
  if (changed.length === 0) throw new AppError("NOT_FOUND", "Записът не е намерен.");
}

export async function deleteEntry(db: TypedClient, id: string): Promise<void> {
  if (!UUID.test(id)) throw new AppError("NOT_FOUND", "Записът не е намерен.");
  const { data, error } = await db.from("food_entries").delete().eq("id", id).select("id");
  if (error) throw new Error(`delete food entry failed: ${error.message}`);
  if (data.length === 0) throw new AppError("NOT_FOUND", "Записът не е намерен.");
}

/**
 * Her most recently logged foods, one per name (case-insensitive), newest first. Looks at her last
 * RECENT_SCAN rows, which is plenty for a short quick-add list.
 */
export async function recentFoods(
  db: TypedClient,
  userId: string,
  limit = 10,
): Promise<FoodItem[]> {
  const { data, error } = await db
    .from("food_entries")
    .select("name, grams, kcal, protein_g, carbs_g, fat_g")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("position")
    .limit(RECENT_SCAN);
  if (error) throw new Error(`load recent foods failed: ${error.message}`);
  const seen = new Set<string>();
  const out: FoodItem[] = [];
  for (const r of data) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: r.name,
      grams: r.grams,
      kcal: r.kcal,
      proteinG: r.protein_g,
      carbsG: r.carbs_g,
      fatG: r.fat_g,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** The last `days` days up to and including `today`, oldest first; days without entries are zero. */
export async function historyDays(
  db: TypedClient,
  userId: string,
  today: string,
  days = 30,
): Promise<{ day: string; kcal: number; count: number }[]> {
  const first = addDays(today, -(days - 1));
  const byDay = new Map<string, { kcal: number; count: number }>();
  // A day can hold 100 rows, so a month can pass the 1000-row response limit: read page by page.
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("food_entries")
      .select("eaten_on, kcal")
      .eq("user_id", userId)
      .gte("eaten_on", first)
      .lte("eaten_on", today)
      .order("eaten_on")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`load diary history failed: ${error.message}`);
    for (const r of data) {
      const cur = byDay.get(r.eaten_on) ?? { kcal: 0, count: 0 };
      byDay.set(r.eaten_on, { kcal: cur.kcal + r.kcal, count: cur.count + 1 });
    }
    if (data.length < PAGE) break;
  }
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(first, i);
    return { day, ...(byDay.get(day) ?? { kcal: 0, count: 0 }) };
  });
}

function isGoal(value: string | null): value is Goal {
  return value !== null && (GOALS as readonly string[]).includes(value);
}

/**
 * Her nutrition answers (null until she has answered), the daily target (null while any input is
 * missing) and whether she may write. Weight is the latest check-in weight, else the profile weight.
 */
export async function getNutritionProfile(
  db: TypedClient,
  userId: string,
): Promise<{ answers: NutritionAnswers | null; target: Target | null; hasAccess: boolean }> {
  const [profile, checkIn, access] = await Promise.all([
    db
      .from("profiles")
      .select(
        "goal, height_cm, weight_kg, birth_year, activity_level, diet, allergens, avoid_foods, meals_per_day, nutrition_answered_at",
      )
      .eq("id", userId)
      .single(),
    db
      .from("check_ins")
      .select("weight_kg")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.rpc("my_access"),
  ]);
  if (profile.error) throw new Error(`load nutrition profile failed: ${profile.error.message}`);
  if (checkIn.error) throw new Error(`load latest weight failed: ${checkIn.error.message}`);
  if (access.error) throw new Error(`check access failed: ${access.error.message}`);
  const p = profile.data;

  const mealsPerDay = p.meals_per_day;
  const answers: NutritionAnswers | null =
    p.nutrition_answered_at !== null &&
    p.birth_year !== null &&
    p.activity_level !== null &&
    p.diet !== null &&
    (mealsPerDay === 3 || mealsPerDay === 4 || mealsPerDay === 5)
      ? {
          birthYear: p.birth_year,
          activity: p.activity_level,
          diet: p.diet,
          allergens: p.allergens as NutritionAnswers["allergens"],
          avoidFoods: p.avoid_foods ?? "",
          mealsPerDay,
        }
      : null;

  const target = calorieTarget({
    weightKg: checkIn.data?.weight_kg ?? p.weight_kg,
    heightCm: p.height_cm,
    birthYear: p.birth_year,
    activity: p.activity_level,
    goal: isGoal(p.goal) ? p.goal : null,
    today: sofiaToday(),
  });
  return { answers, target, hasAccess: access.data === true };
}

/**
 * Stores her answers and marks them answered. No access needed: onboarding saves them before payment;
 * the app actions decide who may reach the nutrition screen.
 */
export async function saveNutritionAnswers(
  db: TypedClient,
  userId: string,
  answers: NutritionAnswers,
): Promise<void> {
  const parsed = nutritionAnswersSchema(Number(sofiaToday().slice(0, 4))).safeParse(answers);
  if (!parsed.success) throw new AppError("INVALID", "Провери отговорите.");
  const a = parsed.data;

  const { data, error } = await db
    .from("profiles")
    .update({
      birth_year: a.birthYear,
      activity_level: a.activity,
      diet: a.diet,
      allergens: [...new Set(a.allergens)],
      avoid_foods: a.avoidFoods === "" ? null : a.avoidFoods,
      meals_per_day: a.mealsPerDay,
      nutrition_answered_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("id");
  if (error) throw new Error(`save nutrition answers failed: ${error.message}`);
  if (data.length === 0) throw new AppError("NOT_FOUND", "Профилът не е намерен.");
}

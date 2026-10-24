import { AppError } from "@/lib/app-error";
import { shiftDay } from "@/lib/nutrition/day-param";
import {
  buildMenu,
  nextCandidate,
  scalePortion,
  type MenuPrefs,
  type MenuSlot,
} from "@/lib/nutrition/menu";
import { sofiaToday } from "@/lib/progress-photos/today";
import { toMeal } from "@/server/admin/meals";
import type { TypedClient } from "@/server/db/types";
import { addEntries, getDiaryDay, getNutritionProfile } from "./diary";

/** Target used while hers cannot be computed yet. */
export const DEFAULT_TARGET_KCAL = 1800;

const NO_ACCESS = "Нужен е активен абонамент.";
const DEFAULT_PREFS: MenuPrefs = {
  diet: "omnivore",
  allergens: [],
  avoidFoods: "",
  mealsPerDay: 3,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MenuDay = {
  hasAccess: boolean;
  usingDefaultTarget: boolean;
  targetKcal: number;
  slots: MenuSlot[];
  /** Slot indexes already logged to the diary that day. */
  eatenSlots: number[];
};

/**
 * One day's menu for a member. Published meals come through RLS (only members with access see any).
 * The previous two days are built with the same engine, without a "recent" rule of their own and with
 * their stored swaps; what they picked is what she was served lately.
 */
export async function getMenuDay(db: TypedClient, userId: string, day: string): Promise<MenuDay> {
  const profile = await getNutritionProfile(db, userId);
  const usingDefaultTarget = profile.target === null;
  const targetKcal = profile.target?.kcal ?? DEFAULT_TARGET_KCAL;
  if (!profile.hasAccess) {
    return { hasAccess: false, usingDefaultTarget, targetKcal, slots: [], eatenSlots: [] };
  }
  const prefs: MenuPrefs = profile.answers
    ? {
        diet: profile.answers.diet,
        allergens: profile.answers.allergens,
        avoidFoods: profile.answers.avoidFoods,
        mealsPerDay: profile.answers.mealsPerDay,
      }
    : DEFAULT_PREFS;

  const [mealRows, swapRows, diary] = await Promise.all([
    db.from("meals").select("*").eq("published", true).order("id").limit(1000),
    db
      .from("menu_swaps")
      .select("menu_date, slot, meal_id")
      .eq("user_id", userId)
      .gte("menu_date", shiftDay(day, -2))
      .lte("menu_date", day),
    getDiaryDay(db, userId, day),
  ]);
  if (mealRows.error) throw new Error(`load meals failed: ${mealRows.error.message}`);
  if (swapRows.error) throw new Error(`load menu swaps failed: ${swapRows.error.message}`);
  const meals = mealRows.data.map(toMeal);

  const swapsOf = (date: string) =>
    new Map(swapRows.data.filter((r) => r.menu_date === date).map((r) => [r.slot, r.meal_id]));
  const build = (date: string, recentMealIds: Set<string>) =>
    buildMenu({ meals, prefs, targetKcal, userId, date, recentMealIds, swaps: swapsOf(date) });

  const recentMealIds = new Set<string>();
  for (const back of [1, 2]) {
    for (const slot of build(shiftDay(day, -back), new Set())) {
      if (slot.pick) recentMealIds.add(slot.pick.meal.id);
    }
  }
  const slots = build(day, recentMealIds);

  const eaten = diary.entries.filter((entry) => entry.source === "menu");
  const eatenSlots = slots
    .filter((s) => s.pick && eaten.some((e) => e.meal === s.meal && e.name === s.pick?.meal.title))
    .map((s) => s.slot);
  return { hasAccess: true, usingDefaultTarget, targetKcal, slots, eatenSlots };
}

/** Swaps and logging change today's menu only; the day and slot come from the client, so both are checked. */
async function loadSlot(
  db: TypedClient,
  userId: string,
  day: string,
  slot: number,
): Promise<{ menu: MenuDay; item: MenuSlot }> {
  if (day !== sofiaToday()) throw new AppError("INVALID", "Менюто се сменя само за днес.");
  const menu = await getMenuDay(db, userId, day);
  if (!menu.hasAccess) throw new AppError("INVALID", NO_ACCESS);
  const item = Number.isInteger(slot) ? menu.slots[slot] : undefined;
  if (!item) throw new AppError("INVALID", "Невалидно ястие.");
  return { menu, item };
}

/** Stores the next candidate of today's slot (wrapping). The next read serves it. */
export async function swapSlot(
  db: TypedClient,
  userId: string,
  input: { day: string; slot: number },
): Promise<void> {
  const { item } = await loadSlot(db, userId, input.day, input.slot);
  const next = nextCandidate(item);
  if (!next) throw new AppError("INVALID", "Няма друго ястие за тази част от деня.");
  const { error } = await db
    .from("menu_swaps")
    .upsert({ user_id: userId, menu_date: input.day, slot: item.slot, meal_id: next });
  if (error) {
    if (error.code === "42501") throw new AppError("INVALID", NO_ACCESS);
    throw new Error(`save menu swap failed: ${error.message}`);
  }
}

/**
 * Logs today's slot as one diary entry. The portion is recomputed here, so nothing numeric comes from
 * the client; the batch id makes a retried request a no-op.
 */
export async function eatSlot(
  db: TypedClient,
  userId: string,
  input: { day: string; slot: number; batchId: string },
): Promise<void> {
  if (!UUID.test(input.batchId)) throw new AppError("INVALID", "Невалидни данни за записа.");
  const { item } = await loadSlot(db, userId, input.day, input.slot);
  if (!item.pick) throw new AppError("INVALID", "Няма ястие за тази част от деня.");
  const portion = scalePortion(item.pick.meal, item.pick.factor);
  await addEntries(db, userId, {
    day: input.day,
    meal: item.meal,
    batchId: input.batchId,
    source: "menu",
    items: [
      {
        name: item.pick.meal.title,
        grams: portion.grams >= 1 ? Math.min(2000, portion.grams) : null,
        kcal: portion.kcal,
        proteinG: portion.proteinG,
        carbsG: portion.carbsG,
        fatG: portion.fatG,
      },
    ],
  });
}

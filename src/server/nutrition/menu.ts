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
import type { TypedClient } from "@/server/db/types";
import { addEntries, getDiaryDay, getNutritionProfile } from "./diary";
import { listPublishedMeals } from "./meals";

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

  const [meals, swapRows, diary] = await Promise.all([
    listPublishedMeals(db),
    db
      .from("menu_swaps")
      .select("menu_date, slot, meal_id")
      .eq("user_id", userId)
      .gte("menu_date", shiftDay(day, -2))
      .lte("menu_date", day),
    getDiaryDay(db, userId, day),
  ]);
  if (swapRows.error) throw new Error(`load menu swaps failed: ${swapRows.error.message}`);

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
  const today = sofiaToday();
  if (day !== today) {
    // A page left open past midnight sends yesterday: say what happened instead of "only for today".
    if (day === shiftDay(today, -1)) {
      throw new AppError("INVALID", "Започна нов ден — презареди менюто.");
    }
    throw new AppError("INVALID", "Менюто е само за днес.");
  }
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
  const { menu, item } = await loadSlot(db, userId, input.day, input.slot);
  // A logged slot is final: swapping would move the pick away from the entry in her diary.
  if (menu.eatenSlots.includes(item.slot)) {
    throw new AppError("INVALID", "Това ястие вече е записано в дневника.");
  }
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

/** Stores the pick as today's choice for the slot, so a meal published later cannot take its place. */
async function pinSlot(db: TypedClient, userId: string, day: string, item: MenuSlot) {
  if (!item.pick) return;
  const { error } = await db
    .from("menu_swaps")
    .upsert({ user_id: userId, menu_date: day, slot: item.slot, meal_id: item.pick.meal.id });
  if (error) {
    if (error.code === "42501") throw new AppError("INVALID", NO_ACCESS);
    throw new Error(`pin menu slot failed: ${error.message}`);
  }
}

/**
 * Logs today's slot as one diary entry. The portion is recomputed here, so nothing numeric comes from
 * the client; the batch id makes a retried request a no-op. `mealId` is the dish her screen showed: if
 * the menu has changed since, nothing is logged. The eaten pick is pinned afterwards (the engine still
 * drops the pin if the meal stops fitting her, e.g. a new allergen), so the slot stays what she ate.
 */
export async function eatSlot(
  db: TypedClient,
  userId: string,
  input: { day: string; slot: number; batchId: string; mealId: string },
): Promise<void> {
  if (!UUID.test(input.batchId)) throw new AppError("INVALID", "Невалидни данни за записа.");
  const { menu, item } = await loadSlot(db, userId, input.day, input.slot);
  // Already in her diary (a second tap with a new batch id): nothing more to add. The pin is repeated
  // here in case the first request logged the entry but failed before storing it.
  if (menu.eatenSlots.includes(item.slot)) {
    await pinSlot(db, userId, input.day, item);
    return;
  }
  if (!item.pick) throw new AppError("INVALID", "Няма ястие за тази част от деня.");
  if (item.pick.meal.id !== input.mealId) {
    throw new AppError("INVALID", "Менюто се промени — презареди.");
  }
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
        proteinG: Math.min(1000, portion.proteinG),
        carbsG: Math.min(1000, portion.carbsG),
        fatG: Math.min(1000, portion.fatG),
      },
    ],
  });
  await pinSlot(db, userId, input.day, item);
}

import type { Allergen, Diet, MealSlot } from "./labels";
import type { Meal } from "./meal-schema";

/** Slots per `meals_per_day` with each slot's share of the daily target; slot index = position. */
export const SLOT_PLANS: Record<3 | 4 | 5, { meal: MealSlot; share: number }[]> = {
  3: [
    { meal: "breakfast", share: 0.25 },
    { meal: "lunch", share: 0.4 },
    { meal: "dinner", share: 0.35 },
  ],
  4: [
    { meal: "breakfast", share: 0.25 },
    { meal: "lunch", share: 0.35 },
    { meal: "dinner", share: 0.3 },
    { meal: "snack", share: 0.1 },
  ],
  5: [
    { meal: "breakfast", share: 0.2 },
    { meal: "lunch", share: 0.35 },
    { meal: "dinner", share: 0.25 },
    { meal: "snack", share: 0.1 },
    { meal: "snack", share: 0.1 },
  ],
};

/** What the engine needs to know about the member. */
export type MenuPrefs = {
  diet: Diet;
  allergens: Allergen[];
  avoidFoods: string;
  mealsPerDay: 3 | 4 | 5;
};

/** Avoid words: split on anything that is not a letter or digit (commas, semicolons, dots, brackets), lower-cased, at least 3 letters. */
function avoidWords(avoidFoods: string): string[] {
  return avoidFoods
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
}

/** True when the meal suits the diet, shares no allergen and contains no avoided word. */
export function mealFits(meal: Meal, prefs: MenuPrefs): boolean {
  const dietOk =
    prefs.diet === "omnivore" ||
    (prefs.diet === "vegan" && meal.fitsVegan) ||
    (prefs.diet === "vegetarian" && (meal.fitsVegetarian || meal.fitsVegan)) ||
    (prefs.diet === "pescatarian" &&
      (meal.fitsPescatarian || meal.fitsVegetarian || meal.fitsVegan));
  if (!dietOk) return false;
  if (meal.allergens.some((allergen) => prefs.allergens.includes(allergen))) return false;
  const words = avoidWords(prefs.avoidFoods);
  if (words.length === 0) return true;
  const text = [meal.title, ...meal.ingredients.map((i) => i.name)].join(" ").toLowerCase();
  return !words.some((word) => text.includes(word));
}

/** slotKcal / mealKcal clamped to 0.75-1.5 and rounded half-up to the nearest 0.05. */
export function portionFactor(mealKcal: number, slotKcal: number): number {
  const clamped = Math.min(1.5, Math.max(0.75, slotKcal / mealKcal));
  return Math.round(clamped * 20 + 1e-9) / 20;
}

/** „порция ×1,2“ (comma decimal); null for a standard portion. */
export function formatPortion(factor: number): string | null {
  const rounded = Number(factor.toFixed(2));
  if (rounded === 1) return null;
  return `порция ×${String(rounded).replace(".", ",")}`;
}

/** Meal values for a portion: kcal whole, macros to 0.1 g, ingredient grams whole; `grams` is their sum. */
export function scalePortion(
  meal: Meal,
  factor: number,
): {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: { name: string; grams: number }[];
  grams: number;
} {
  const macro = (value: number) => Math.round(value * factor * 10 + 1e-9) / 10;
  // The list is written for `servings` portions; kcal and macros are per portion already.
  const perPortion = factor / (meal.servings || 1);
  const ingredients = meal.ingredients.map((i) => ({
    name: i.name,
    grams: Math.round(i.grams * perPortion),
  }));
  return {
    kcal: Math.round(meal.kcal * factor),
    proteinG: macro(meal.proteinG),
    carbsG: macro(meal.carbsG),
    fatG: macro(meal.fatG),
    ingredients,
    grams: ingredients.reduce((sum, i) => sum + i.grams, 0),
  };
}

/** One slot of a day's menu; `candidates` are meal ids in the order „Смени“ cycles through. */
export type MenuSlot = {
  slot: number;
  meal: MealSlot;
  slotKcal: number;
  pick: { meal: Meal; factor: number } | null;
  candidates: string[];
};

/** FNV-1a 32-bit hash, used only for stable tie-breaks. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Builds one day's menu, deterministic per (userId, date). Candidates per slot are published meals of
 * that type that fit her prefs and are not already used that day, non-recent ones first, each group
 * ordered by closeness to the slot's kcal then by hash. A stored swap wins only while its meal is
 * still among the slot's candidates (the DB does not check swap targets), otherwise it is ignored.
 */
export function buildMenu(input: {
  meals: Meal[];
  prefs: MenuPrefs;
  targetKcal: number;
  userId: string;
  date: string;
  recentMealIds: Set<string>;
  swaps: Map<number, string>;
}): MenuSlot[] {
  const { meals, prefs, targetKcal, userId, date, recentMealIds, swaps } = input;
  const fitting = meals.filter((meal) => meal.published && mealFits(meal, prefs));
  const used = new Set<string>();

  return SLOT_PLANS[prefs.mealsPerDay].map((plan, slot) => {
    const slotKcal = Math.round(targetKcal * plan.share);
    const ranked = fitting
      .filter((meal) => meal.mealTypes.includes(plan.meal) && !used.has(meal.id))
      .map((meal) => {
        const factor = portionFactor(meal.kcal, slotKcal);
        return {
          meal,
          factor,
          recent: recentMealIds.has(meal.id),
          distance: Math.abs(meal.kcal * factor - slotKcal),
          hash: fnv1a(`${userId}|${date}|${meal.id}`),
        };
      })
      .sort(
        (a, b) => Number(a.recent) - Number(b.recent) || a.distance - b.distance || a.hash - b.hash,
      );

    const swapId = swaps.get(slot);
    const chosen = (swapId !== undefined && ranked.find((c) => c.meal.id === swapId)) || ranked[0];
    if (chosen) used.add(chosen.meal.id);

    return {
      slot,
      meal: plan.meal,
      slotKcal,
      pick: chosen ? { meal: chosen.meal, factor: chosen.factor } : null,
      candidates: ranked.map((c) => c.meal.id),
    };
  });
}

/** The candidate after the current pick (wrapping), or null when there is nothing else to choose. */
export function nextCandidate(slot: MenuSlot): string | null {
  const { candidates, pick } = slot;
  if (candidates.length < 2) return null;
  const index = pick ? candidates.indexOf(pick.meal.id) : -1;
  return candidates[(index + 1) % candidates.length];
}

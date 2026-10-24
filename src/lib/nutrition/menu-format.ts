import { MEAL_LABEL, type MealSlot } from "./labels";
import { scalePortion, type MenuSlot } from "./menu";

/**
 * „Закуска“, „Обяд“, „Вечеря“, „Междинно“; when the plan has several slots of one type (the 5-meal
 * plan has two snacks) they are numbered by position: „Междинно 1“, „Междинно 2“.
 */
export function slotLabel(
  meal: MealSlot,
  index: number,
  plan: readonly { meal: MealSlot }[],
): string {
  const sameType = plan.reduce<number[]>((acc, p, i) => (p.meal === meal ? [...acc, i] : acc), []);
  if (sameType.length < 2) return MEAL_LABEL[meal];
  return `${MEAL_LABEL[meal]} ${sameType.indexOf(index) + 1}`;
}

/** What the picked portions of a day add up to; slots without a meal count for nothing. */
export function menuTotals(slots: readonly MenuSlot[]): {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  filled: number;
} {
  const totals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, filled: 0 };
  for (const { pick } of slots) {
    if (!pick) continue;
    const portion = scalePortion(pick.meal, pick.factor);
    totals.kcal += portion.kcal;
    totals.proteinG += portion.proteinG;
    totals.carbsG += portion.carbsG;
    totals.fatG += portion.fatG;
    totals.filled += 1;
  }
  const tenth = (value: number) => Math.round(value * 10) / 10;
  return {
    ...totals,
    proteinG: tenth(totals.proteinG),
    carbsG: tenth(totals.carbsG),
    fatG: tenth(totals.fatG),
  };
}

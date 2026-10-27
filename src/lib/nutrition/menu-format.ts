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

/** True when the day has slots but none of them has a meal (the library has nothing for her yet). */
export function allSlotsEmpty(slots: readonly MenuSlot[]): boolean {
  return slots.length > 0 && slots.every((s) => !s.pick);
}

/** A not-yet-eaten dish of today's menu, small enough to hand to the diary (the full meal stays on the server). */
export type MenuDish = {
  slot: number;
  meal: MealSlot;
  mealId: string;
  title: string;
  kcal: number;
};

/** Today's dishes she has not eaten yet, with the kcal of her portion. */
export function openMenuDishes(
  slots: readonly MenuSlot[],
  eatenSlots: readonly number[],
): MenuDish[] {
  return slots.flatMap((s) =>
    s.pick && !eatenSlots.includes(s.slot)
      ? [
          {
            slot: s.slot,
            meal: s.meal,
            mealId: s.pick.meal.id,
            title: s.pick.meal.title,
            kcal: scalePortion(s.pick.meal, s.pick.factor).kcal,
          },
        ]
      : [],
  );
}

/** The „От менюто“ chips of the add sheet for one meal: the open dishes whose slot is that meal. */
export function menuChipsFor(meal: MealSlot | "drinks", dishes: readonly MenuDish[]): MenuDish[] {
  return dishes.filter((d) => d.meal === meal);
}

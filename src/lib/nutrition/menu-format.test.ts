import { describe, expect, it } from "vitest";
import type { Meal } from "./meal-schema";
import { menuTotals, slotLabel } from "./menu-format";
import { SLOT_PLANS, type MenuSlot } from "./menu";

function meal(over: Partial<Meal> = {}): Meal {
  return {
    id: "m1",
    published: true,
    title: "Овесена каша",
    mealTypes: ["breakfast"],
    ingredients: [{ name: "Овес", grams: 100 }],
    kcal: 400,
    proteinG: 20,
    carbsG: 50,
    fatG: 10,
    fitsVegetarian: true,
    fitsVegan: false,
    fitsPescatarian: true,
    allergens: [],
    steps: "",
    photoUrl: null,
    ...over,
  };
}

function slot(index: number, pick: MenuSlot["pick"]): MenuSlot {
  return { slot: index, meal: "breakfast", slotKcal: 400, pick, candidates: [] };
}

describe("slotLabel", () => {
  it("names the main meals", () => {
    const plan = SLOT_PLANS[3];
    expect(slotLabel("breakfast", 0, plan)).toBe("Закуска");
    expect(slotLabel("lunch", 1, plan)).toBe("Обяд");
    expect(slotLabel("dinner", 2, plan)).toBe("Вечеря");
  });

  it("leaves a single snack unnumbered", () => {
    expect(slotLabel("snack", 3, SLOT_PLANS[4])).toBe("Междинно");
  });

  it("numbers the two snacks of the 5-meal plan by position", () => {
    const plan = SLOT_PLANS[5];
    expect(slotLabel("snack", 3, plan)).toBe("Междинно 1");
    expect(slotLabel("snack", 4, plan)).toBe("Междинно 2");
  });
});

describe("menuTotals", () => {
  it("is zero for an empty day", () => {
    expect(menuTotals([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, filled: 0 });
  });

  it("sums the scaled portions and skips empty slots", () => {
    const totals = menuTotals([
      slot(0, { meal: meal(), factor: 1 }),
      slot(1, {
        meal: meal({ id: "m2", kcal: 600, proteinG: 30.5, carbsG: 70, fatG: 20 }),
        factor: 1.2,
      }),
      slot(2, null),
    ]);
    // 400 + round(600 * 1.2) = 1120; protein 20 + 36.6; carbs 50 + 84; fat 10 + 24
    expect(totals).toEqual({ kcal: 1120, proteinG: 56.6, carbsG: 134, fatG: 34, filled: 2 });
  });
});

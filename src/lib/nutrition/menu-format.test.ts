import { describe, expect, it } from "vitest";
import type { Meal } from "./meal-schema";
import { allSlotsEmpty, menuChipsFor, openMenuDishes, menuTotals, slotLabel } from "./menu-format";
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

describe("allSlotsEmpty", () => {
  it("is true only when no slot has a pick", () => {
    expect(allSlotsEmpty([slot(0, null), slot(1, null)])).toBe(true);
    expect(allSlotsEmpty([slot(0, null), slot(1, { meal: meal(), factor: 1 })])).toBe(false);
    expect(allSlotsEmpty([])).toBe(false);
  });
});

describe("menu chips for the diary add sheet", () => {
  const typed = (index: number, type: MenuSlot["meal"], pick: MenuSlot["pick"]): MenuSlot => ({
    ...slot(index, pick),
    meal: type,
  });
  const slots: MenuSlot[] = [
    typed(0, "breakfast", { meal: meal({ id: "b", title: "Каша", kcal: 400 }), factor: 1.25 }),
    typed(1, "lunch", { meal: meal({ id: "l", title: "Супа", kcal: 600 }), factor: 1 }),
    typed(2, "dinner", null),
    typed(3, "snack", { meal: meal({ id: "s1", title: "Ябълка", kcal: 100 }), factor: 1 }),
    typed(4, "snack", { meal: meal({ id: "s2", title: "Ядки", kcal: 200 }), factor: 0.75 }),
  ];

  it("lists today's dishes that are not eaten yet, scaled to her portion", () => {
    expect(openMenuDishes(slots, [1])).toEqual([
      { slot: 0, meal: "breakfast", mealId: "b", title: "Каша", kcal: 500 },
      { slot: 3, meal: "snack", mealId: "s1", title: "Ябълка", kcal: 100 },
      { slot: 4, meal: "snack", mealId: "s2", title: "Ядки", kcal: 150 },
    ]);
  });

  it("offers only the dishes whose slot is the sheet's meal", () => {
    const dishes = openMenuDishes(slots, []);
    expect(menuChipsFor("breakfast", dishes).map((c) => c.mealId)).toEqual(["b"]);
    expect(menuChipsFor("snack", dishes).map((c) => c.mealId)).toEqual(["s1", "s2"]);
    expect(menuChipsFor("dinner", dishes)).toEqual([]);
  });

  it("drops eaten slots and empty slots", () => {
    expect(menuChipsFor("lunch", openMenuDishes(slots, [1]))).toEqual([]);
    expect(openMenuDishes([], [])).toEqual([]);
  });
});

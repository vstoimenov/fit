import { describe, expect, it } from "vitest";
import { DIETS, MEAL_SLOTS } from "@/lib/nutrition/labels";
import type { Meal } from "@/lib/nutrition/meal-schema";
import { mealCoverage } from "./meals";

function meal(over: Partial<Meal>): Meal {
  return {
    id: "m",
    title: "Ястие",
    mealTypes: ["lunch"],
    ingredients: [{ name: "Ориз", grams: 100 }],
    kcal: 500,
    proteinG: 20,
    carbsG: 60,
    fatG: 10,
    fitsVegetarian: false,
    fitsVegan: false,
    fitsPescatarian: false,
    allergens: [],
    steps: "",
    photoUrl: null,
    description: "",
    prepMin: null,
    cookMin: null,
    servings: 1,
    published: true,
    ...over,
  };
}

const count = (rows: ReturnType<typeof mealCoverage>, diet: string, slot: string) =>
  rows.find((r) => r.diet === diet && r.meal === slot)?.count;

describe("mealCoverage", () => {
  it("returns every diet x meal type, with zero for empty cells", () => {
    const rows = mealCoverage([]);
    expect(rows).toHaveLength(DIETS.length * MEAL_SLOTS.length);
    expect(rows.every((r) => r.count === 0)).toBe(true);
    for (const diet of DIETS)
      for (const slot of MEAL_SLOTS) expect(rows).toContainEqual({ diet, meal: slot, count: 0 });
  });

  it("counts a plain meal for omnivores only", () => {
    const rows = mealCoverage([meal({})]);
    expect(count(rows, "omnivore", "lunch")).toBe(1);
    for (const diet of ["vegetarian", "vegan", "pescatarian"]) {
      expect(count(rows, diet, "lunch")).toBe(0);
    }
    expect(count(rows, "omnivore", "dinner")).toBe(0);
  });

  it("follows the diet compatibility ladder", () => {
    const rows = mealCoverage([
      meal({ id: "a", fitsPescatarian: true }),
      meal({ id: "b", fitsVegetarian: true }),
      meal({ id: "c", fitsVegan: true }),
    ]);
    expect(count(rows, "omnivore", "lunch")).toBe(3);
    expect(count(rows, "pescatarian", "lunch")).toBe(3);
    expect(count(rows, "vegetarian", "lunch")).toBe(2);
    expect(count(rows, "vegan", "lunch")).toBe(1);
  });

  it("counts a multi-type meal once per type and ignores allergens", () => {
    const rows = mealCoverage([meal({ mealTypes: ["lunch", "dinner"], allergens: ["gluten"] })]);
    expect(count(rows, "omnivore", "lunch")).toBe(1);
    expect(count(rows, "omnivore", "dinner")).toBe(1);
    expect(count(rows, "omnivore", "breakfast")).toBe(0);
  });

  it("counts published meals only", () => {
    const rows = mealCoverage([meal({ published: false }), meal({ id: "p" })]);
    expect(count(rows, "omnivore", "lunch")).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { mealInputSchema } from "./meal-schema";

const valid = {
  title: "Овесена каша с банан",
  mealTypes: ["breakfast"],
  ingredients: [{ name: "Овесени ядки", grams: 60 }],
  kcal: 420,
  proteinG: 14,
  carbsG: 70,
  fatG: 8,
  fitsVegetarian: true,
  fitsVegan: false,
  fitsPescatarian: true,
  allergens: ["gluten"],
  steps: "Свари ядките.",
  photoUrl: "/photos/kasha.jpg",
};

describe("mealInputSchema", () => {
  it("accepts a valid meal", () => {
    // The recipe details are optional: a meal without them gets the defaults.
    expect(mealInputSchema.parse(valid)).toEqual({
      ...valid,
      description: "",
      prepMin: null,
      cookMin: null,
      servings: 1,
    });
  });

  it("refuses a measure without its unit, and servings outside 1–24", () => {
    const bad = (over: object) => mealInputSchema.safeParse({ ...valid, ...over }).success;
    expect(bad({ ingredients: [{ name: "Сол", grams: 3, amount: 0.5 }] })).toBe(false);
    expect(bad({ ingredients: [{ name: "Сол", grams: 3, amount: 0.5, unit: "ч.л." }] })).toBe(true);
    expect(bad({ servings: 0 })).toBe(false);
    expect(bad({ servings: 25 })).toBe(false);
    expect(bad({ prepMin: 601 })).toBe(false);
  });

  it("defaults optional fields and treats an empty photo as none", () => {
    const { steps, photoUrl, allergens, ...rest } = valid;
    void steps;
    void photoUrl;
    void allergens;
    expect(mealInputSchema.parse(rest)).toMatchObject({ steps: "", photoUrl: null, allergens: [] });
    expect(mealInputSchema.parse({ ...valid, photoUrl: "" }).photoUrl).toBeNull();
  });

  it("bounds the title to 2-120 characters", () => {
    expect(mealInputSchema.safeParse({ ...valid, title: "а" }).success).toBe(false);
    expect(mealInputSchema.safeParse({ ...valid, title: "аб" }).success).toBe(true);
    expect(mealInputSchema.safeParse({ ...valid, title: "а".repeat(120) }).success).toBe(true);
    expect(mealInputSchema.safeParse({ ...valid, title: "а".repeat(121) }).success).toBe(false);
  });

  it("needs 1-30 ingredients with name 1-80 and grams 1-2000", () => {
    expect(mealInputSchema.safeParse({ ...valid, ingredients: [] }).success).toBe(false);
    const thirty = Array.from({ length: 30 }, () => ({ name: "х", grams: 1 }));
    expect(mealInputSchema.safeParse({ ...valid, ingredients: thirty }).success).toBe(true);
    expect(
      mealInputSchema.safeParse({ ...valid, ingredients: [...thirty, { name: "х", grams: 1 }] })
        .success,
    ).toBe(false);
    expect(
      mealInputSchema.safeParse({ ...valid, ingredients: [{ name: "", grams: 5 }] }).success,
    ).toBe(false);
    expect(
      mealInputSchema.safeParse({ ...valid, ingredients: [{ name: "а".repeat(81), grams: 5 }] })
        .success,
    ).toBe(false);
    expect(
      mealInputSchema.safeParse({ ...valid, ingredients: [{ name: "а", grams: 0 }] }).success,
    ).toBe(false);
    expect(
      mealInputSchema.safeParse({ ...valid, ingredients: [{ name: "а", grams: 2001 }] }).success,
    ).toBe(false);
    expect(
      mealInputSchema.safeParse({ ...valid, ingredients: [{ name: "а", grams: 2000 }] }).success,
    ).toBe(true);
  });

  it("needs an integer kcal between 1 and 3000", () => {
    expect(mealInputSchema.safeParse({ ...valid, kcal: 0 }).success).toBe(false);
    expect(mealInputSchema.safeParse({ ...valid, kcal: 1 }).success).toBe(true);
    expect(mealInputSchema.safeParse({ ...valid, kcal: 3000 }).success).toBe(true);
    expect(mealInputSchema.safeParse({ ...valid, kcal: 3001 }).success).toBe(false);
    expect(mealInputSchema.safeParse({ ...valid, kcal: 420.5 }).success).toBe(false);
  });

  it("bounds each macro to 0-1000 g", () => {
    for (const key of ["proteinG", "carbsG", "fatG"] as const) {
      expect(mealInputSchema.safeParse({ ...valid, [key]: 0 }).success).toBe(true);
      expect(mealInputSchema.safeParse({ ...valid, [key]: 1000 }).success).toBe(true);
      expect(mealInputSchema.safeParse({ ...valid, [key]: -1 }).success).toBe(false);
      expect(mealInputSchema.safeParse({ ...valid, [key]: 1001 }).success).toBe(false);
    }
  });

  it("caps the steps at 10 000 characters", () => {
    expect(mealInputSchema.safeParse({ ...valid, steps: "а".repeat(10_000) }).success).toBe(true);
    expect(mealInputSchema.safeParse({ ...valid, steps: "а".repeat(10_001) }).success).toBe(false);
  });

  it("needs 1-4 distinct meal types", () => {
    expect(mealInputSchema.safeParse({ ...valid, mealTypes: [] }).success).toBe(false);
    expect(mealInputSchema.safeParse({ ...valid, mealTypes: ["lunch", "lunch"] }).success).toBe(
      false,
    );
    expect(mealInputSchema.safeParse({ ...valid, mealTypes: ["brunch"] }).success).toBe(false);
    expect(
      mealInputSchema.safeParse({ ...valid, mealTypes: ["breakfast", "lunch", "dinner", "snack"] })
        .success,
    ).toBe(true);
  });

  it("only accepts known allergen codes, once each", () => {
    expect(mealInputSchema.safeParse({ ...valid, allergens: ["peanut"] }).success).toBe(false);
    expect(mealInputSchema.safeParse({ ...valid, allergens: ["milk", "milk"] }).success).toBe(
      false,
    );
  });

  it("accepts local /photos paths and https, rejects the rest", () => {
    for (const ok of ["/photos/a/b-c_d.jpg", "https://cdn.example.com/a.jpg?x=1"]) {
      expect(mealInputSchema.safeParse({ ...valid, photoUrl: ok }).success).toBe(true);
    }
    for (const bad of [
      "http://example.com/a.jpg",
      "/photos/a.jpg?x=1",
      "/photos/a b.jpg",
      "/photos/a.jpg#x",
      "/other/a.jpg",
      "javascript:alert(1)",
    ]) {
      expect(mealInputSchema.safeParse({ ...valid, photoUrl: bad }).success).toBe(false);
    }
  });

  describe("diet flags against allergens", () => {
    const VEGAN = "Веган ястие не може да съдържа мляко, яйца, риба, ракообразни или мекотели.";
    const VEGETARIAN = "Вегетарианско ястие не може да съдържа риба, ракообразни или мекотели.";

    it.each(["milk", "eggs", "fish", "crustaceans", "molluscs"])(
      "a vegan meal cannot contain %s",
      (allergen) => {
        const result = mealInputSchema.safeParse({
          ...valid,
          fitsVegan: true,
          allergens: [allergen],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues.map((i) => i.message)).toContain(VEGAN);
      },
    );

    it.each(["fish", "crustaceans", "molluscs"])(
      "a vegetarian meal cannot contain %s",
      (allergen) => {
        const result = mealInputSchema.safeParse({
          ...valid,
          fitsVegetarian: true,
          allergens: [allergen],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues.map((i) => i.message)).toContain(VEGETARIAN);
      },
    );

    it("a vegetarian meal may contain milk and eggs; a pescatarian one anything", () => {
      expect(
        mealInputSchema.safeParse({ ...valid, fitsVegetarian: true, allergens: ["milk", "eggs"] })
          .success,
      ).toBe(true);
      expect(
        mealInputSchema.safeParse({
          ...valid,
          fitsVegetarian: false,
          fitsPescatarian: true,
          allergens: ["fish", "molluscs"],
        }).success,
      ).toBe(true);
    });

    it("a vegan meal with other allergens is fine", () => {
      expect(
        mealInputSchema.safeParse({
          ...valid,
          fitsVegan: true,
          fitsVegetarian: true,
          allergens: ["gluten", "soy"],
        }).success,
      ).toBe(true);
    });
  });
});

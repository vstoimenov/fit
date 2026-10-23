import { describe, expect, it } from "vitest";
import {
  estimateItemSchema,
  estimateSchema,
  foodTextSchema,
  manualEntrySchema,
  nutritionAnswersSchema,
} from "./schema";

const item = { name: "Овесена каша", grams: 100, kcal: 165, proteinG: 5, carbsG: 28, fatG: 3 };

describe("estimateItemSchema", () => {
  it("accepts a valid item", () => {
    expect(estimateItemSchema.safeParse(item).success).toBe(true);
  });

  it("rejects kcal above 3000 and accepts 3000", () => {
    expect(estimateItemSchema.safeParse({ ...item, kcal: 3001 }).success).toBe(false);
    expect(estimateItemSchema.safeParse({ ...item, kcal: 3000 }).success).toBe(true);
  });

  it("rejects grams outside 1–2000", () => {
    expect(estimateItemSchema.safeParse({ ...item, grams: 0 }).success).toBe(false);
    expect(estimateItemSchema.safeParse({ ...item, grams: 2001 }).success).toBe(false);
  });

  it("rejects negative macros", () => {
    expect(estimateItemSchema.safeParse({ ...item, proteinG: -1 }).success).toBe(false);
  });
});

describe("estimateSchema", () => {
  it("accepts up to 12 items", () => {
    expect(estimateSchema.safeParse({ items: Array(12).fill(item) }).success).toBe(true);
  });

  it("rejects 13 items", () => {
    expect(estimateSchema.safeParse({ items: Array(13).fill(item) }).success).toBe(false);
  });
});

describe("manualEntrySchema", () => {
  it("accepts a name and kcal without macros", () => {
    expect(manualEntrySchema.safeParse({ name: "Ябълка", kcal: 80 }).success).toBe(true);
  });

  it("rejects an empty name and a name over 120 characters", () => {
    expect(manualEntrySchema.safeParse({ name: "", kcal: 80 }).success).toBe(false);
    expect(manualEntrySchema.safeParse({ name: "а".repeat(121), kcal: 80 }).success).toBe(false);
  });

  it("accepts kcal up to 5000 and rejects 5001", () => {
    expect(manualEntrySchema.safeParse({ name: "Обяд", kcal: 5000 }).success).toBe(true);
    expect(manualEntrySchema.safeParse({ name: "Обяд", kcal: 5001 }).success).toBe(false);
  });
});

describe("foodTextSchema", () => {
  it("rejects text over 300 characters and accepts exactly 300", () => {
    expect(foodTextSchema.safeParse("а".repeat(301)).success).toBe(false);
    expect(foodTextSchema.safeParse("а".repeat(300)).success).toBe(true);
  });

  it("rejects whitespace-only text", () => {
    expect(foodTextSchema.safeParse("   ").success).toBe(false);
  });

  it("trims the text it accepts", () => {
    expect(foodTextSchema.parse("  две яйца  ")).toBe("две яйца");
  });
});

describe("nutritionAnswersSchema", () => {
  const answers = {
    birthYear: 1990,
    activity: "moderate",
    diet: "vegetarian",
    allergens: ["peanuts", "milk"],
    avoidFoods: "кориандър",
    mealsPerDay: 4,
  };

  it("accepts a complete set of answers", () => {
    expect(nutritionAnswersSchema.safeParse(answers).success).toBe(true);
  });

  it("rejects a birth year before 1940", () => {
    expect(nutritionAnswersSchema.safeParse({ ...answers, birthYear: 1939 }).success).toBe(false);
  });

  it("rejects a birth year under 16 years ago", () => {
    expect(nutritionAnswersSchema.safeParse({ ...answers, birthYear: 2020 }).success).toBe(false);
  });

  it("accepts only 3, 4 or 5 meals per day", () => {
    expect(nutritionAnswersSchema.safeParse({ ...answers, mealsPerDay: 2 }).success).toBe(false);
    expect(nutritionAnswersSchema.safeParse({ ...answers, mealsPerDay: 5 }).success).toBe(true);
  });

  it("rejects an allergen code outside the 14 known codes", () => {
    expect(
      nutritionAnswersSchema.safeParse({ ...answers, allergens: ["peanuts", "bogus"] }).success,
    ).toBe(false);
  });

  it("rejects avoidFoods over 200 characters", () => {
    expect(
      nutritionAnswersSchema.safeParse({ ...answers, avoidFoods: "а".repeat(201) }).success,
    ).toBe(false);
  });

  it("rejects unknown diet and activity codes", () => {
    expect(nutritionAnswersSchema.safeParse({ ...answers, diet: "keto" }).success).toBe(false);
    expect(nutritionAnswersSchema.safeParse({ ...answers, activity: "athlete" }).success).toBe(
      false,
    );
  });
});

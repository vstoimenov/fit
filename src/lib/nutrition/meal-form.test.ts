import { describe, expect, it } from "vitest";
import { emptyMealForm, fillEmptyFields, mealToForm } from "./meal-form";
import type { Meal, MealDraft } from "./meal-schema";

const draft: MealDraft = {
  mealTypes: ["breakfast"],
  ingredients: [
    { name: "Овесени ядки", grams: 60 },
    { name: "Мляко", grams: 200 },
  ],
  kcal: 412,
  proteinG: 16,
  carbsG: 58.3,
  fatG: 11,
  allergens: ["gluten", "milk"],
  fitsVegetarian: true,
  fitsVegan: false,
  fitsPescatarian: true,
};

describe("fillEmptyFields", () => {
  it("fills every empty field of a blank form", () => {
    const filled = fillEmptyFields({ ...emptyMealForm(), title: "Каша" }, draft);
    expect(filled).toMatchObject({
      title: "Каша",
      mealTypes: ["breakfast"],
      kcal: "412",
      proteinG: "16",
      carbsG: "58,3",
      fatG: "11",
      allergens: ["gluten", "milk"],
      fitsVegetarian: true,
      fitsVegan: false,
      fitsPescatarian: true,
    });
    expect(filled.ingredients.map((r) => [r.name, r.grams])).toEqual([
      ["Овесени ядки", "60"],
      ["Мляко", "200"],
    ]);
  });

  it("never touches a field that already has a value", () => {
    const mine = {
      ...emptyMealForm(),
      title: "Каша",
      mealTypes: ["dinner" as const],
      ingredients: [{ key: "a", name: "Ориз", grams: "" }],
      kcal: "500",
      proteinG: "0",
      allergens: ["eggs" as const],
      fitsVegan: true,
    };
    const filled = fillEmptyFields(mine, draft);
    expect(filled.mealTypes).toEqual(["dinner"]);
    expect(filled.ingredients).toEqual(mine.ingredients);
    expect(filled.kcal).toBe("500");
    expect(filled.proteinG).toBe("0");
    expect(filled.allergens).toEqual(["eggs"]);
    expect([filled.fitsVegetarian, filled.fitsVegan, filled.fitsPescatarian]).toEqual([
      false,
      true,
      false,
    ]);
    // Only the still-empty macros were filled.
    expect(filled.carbsG).toBe("58,3");
    expect(filled.fatG).toBe("11");
  });

  it("treats blank ingredient rows as empty", () => {
    const blank = { ...emptyMealForm(), ingredients: [{ key: "a", name: " ", grams: "" }] };
    expect(fillEmptyFields(blank, draft).ingredients).toHaveLength(2);
  });

  it("never publishes or changes the title, steps or photo", () => {
    const form = { ...emptyMealForm(), steps: "", photoUrl: "", published: false };
    const filled = fillEmptyFields(form, {
      ...draft,
      title: "Друго",
      published: true,
    } as MealDraft);
    expect(filled).toMatchObject({ title: "", steps: "", photoUrl: "", published: false });
  });

  it("leaves the form as it is for an empty draft", () => {
    const form = emptyMealForm();
    expect(fillEmptyFields(form, {})).toEqual(form);
  });
});

describe("mealToForm", () => {
  it("turns a stored meal into form strings with comma decimals", () => {
    const meal: Meal = {
      id: "m1",
      title: "Каша",
      mealTypes: ["breakfast", "snack"],
      ingredients: [{ name: "Ядки", grams: 60.5 }],
      kcal: 420,
      proteinG: 14.5,
      carbsG: 70,
      fatG: 8,
      fitsVegetarian: true,
      fitsVegan: false,
      fitsPescatarian: true,
      allergens: ["gluten"],
      steps: "Свари.",
      photoUrl: null,
      published: true,
    };
    const form = mealToForm(meal);
    expect(form).toMatchObject({
      title: "Каша",
      kcal: "420",
      proteinG: "14,5",
      carbsG: "70",
      steps: "Свари.",
      photoUrl: "",
      published: true,
    });
    expect(form.ingredients.map((r) => [r.name, r.grams])).toEqual([["Ядки", "60,5"]]);
  });

  it("starts a new meal with one blank ingredient row", () => {
    expect(emptyMealForm().ingredients).toHaveLength(1);
    expect(emptyMealForm().published).toBe(false);
  });
});

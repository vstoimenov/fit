import type { Allergen, MealSlot } from "./labels";
import type { Meal, MealDraft } from "./meal-schema";

export type IngredientRow = { key: string; name: string; grams: string };

/** What the admin sees and edits: numbers stay text so a half-typed value is never lost. */
export type MealFormState = {
  title: string;
  mealTypes: MealSlot[];
  ingredients: IngredientRow[];
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  fitsVegetarian: boolean;
  fitsVegan: boolean;
  fitsPescatarian: boolean;
  allergens: Allergen[];
  steps: string;
  photoUrl: string;
  published: boolean;
};

/** Numbers are shown with a comma decimal, the way she types them. */
const show = (n: number) => String(n).replace(".", ",");

export function emptyMealForm(): MealFormState {
  return {
    title: "",
    mealTypes: [],
    ingredients: [{ key: "new-0", name: "", grams: "" }],
    kcal: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    fitsVegetarian: false,
    fitsVegan: false,
    fitsPescatarian: false,
    allergens: [],
    steps: "",
    photoUrl: "",
    published: false,
  };
}

export function mealToForm(meal: Meal): MealFormState {
  return {
    title: meal.title,
    mealTypes: meal.mealTypes,
    ingredients: meal.ingredients.map((row, i) => ({
      key: `saved-${i}`,
      name: row.name,
      grams: show(row.grams),
    })),
    kcal: show(meal.kcal),
    proteinG: show(meal.proteinG),
    carbsG: show(meal.carbsG),
    fatG: show(meal.fatG),
    fitsVegetarian: meal.fitsVegetarian,
    fitsVegan: meal.fitsVegan,
    fitsPescatarian: meal.fitsPescatarian,
    allergens: meal.allergens,
    steps: meal.steps,
    photoUrl: meal.photoUrl ?? "",
    published: meal.published,
  };
}

/**
 * Puts an AI draft into the fields that are still empty and leaves everything else as typed. The
 * title, steps, photo and publication state are never touched. A diet is "empty" while none of the
 * three boxes is ticked.
 */
export function fillEmptyFields(form: MealFormState, draft: MealDraft): MealFormState {
  const next = { ...form };
  if (form.mealTypes.length === 0 && draft.mealTypes?.length) next.mealTypes = draft.mealTypes;
  if (
    form.ingredients.every((row) => !row.name.trim() && !row.grams.trim()) &&
    draft.ingredients?.length
  ) {
    next.ingredients = draft.ingredients.map((row, i) => ({
      key: `ai-${i}`,
      name: row.name,
      grams: show(row.grams),
    }));
  }
  for (const key of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
    const value = draft[key];
    if (form[key].trim() === "" && value !== undefined) next[key] = show(value);
  }
  if (form.allergens.length === 0 && draft.allergens?.length) next.allergens = draft.allergens;
  const noDiet = !form.fitsVegetarian && !form.fitsVegan && !form.fitsPescatarian;
  if (
    noDiet &&
    (draft.fitsVegetarian !== undefined ||
      draft.fitsVegan !== undefined ||
      draft.fitsPescatarian !== undefined)
  ) {
    next.fitsVegetarian = draft.fitsVegetarian ?? false;
    next.fitsVegan = draft.fitsVegan ?? false;
    next.fitsPescatarian = draft.fitsPescatarian ?? false;
  }
  return next;
}

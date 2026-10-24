import { AppError } from "@/lib/app-error";
import { DIETS, MEAL_SLOTS, type Diet, type MealSlot } from "@/lib/nutrition/labels";
import { mealInputSchema, type Meal, type MealInput } from "@/lib/nutrition/meal-schema";
import { mealFits } from "@/lib/nutrition/menu";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedClient } from "@/server/db/types";

type MealRow = Database["public"]["Tables"]["meals"]["Row"];

/** A stored meal with the time it was last changed. */
export type MealListItem = Meal & { updatedAt: string };

const NOT_FOUND = "Ястието не е намерено.";
const FORBIDDEN = "Нямаш достъп.";

/** Maps a stored row to the camelCase meal the engine and forms use. */
export const toMeal = (r: MealRow): Meal => ({
  id: r.id,
  title: r.title,
  mealTypes: r.meal_types,
  ingredients: r.ingredients as MealInput["ingredients"],
  kcal: r.kcal,
  proteinG: r.protein_g,
  carbsG: r.carbs_g,
  fatG: r.fat_g,
  fitsVegetarian: r.fits_vegetarian,
  fitsVegan: r.fits_vegan,
  fitsPescatarian: r.fits_pescatarian,
  allergens: r.allergens as MealInput["allergens"],
  steps: r.steps,
  photoUrl: r.photo_url,
  published: r.published,
});

function throwWriteError(error: { code?: string; message?: string }, what: string): never {
  if (error.code === "42501") throw new AppError("FORBIDDEN", FORBIDDEN);
  throw new Error(`${what} failed: ${error.message}`);
}

/** Newest first. A few hundred meals is the expected scale, so the whole library is loaded. */
export async function listMeals(db: TypedClient): Promise<MealListItem[]> {
  const { data, error } = await db
    .from("meals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`list meals failed: ${error.message}`);
  return data.map((r) => ({ ...toMeal(r), updatedAt: r.updated_at }));
}

export async function getMeal(db: TypedClient, id: string): Promise<Meal | null> {
  const { data, error } = await db.from("meals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`load meal failed: ${error.message}`);
  return data ? toMeal(data) : null;
}

/**
 * Creates (no id) or updates a meal. The input is validated against the meal bounds first. The
 * publication state is written only when given, so editing never silently unpublishes.
 */
export async function saveMeal(
  db: TypedClient,
  input: MealInput & { id?: string; published?: boolean },
): Promise<string> {
  const meal = mealInputSchema.parse(input);
  const fields = {
    title: meal.title,
    meal_types: meal.mealTypes,
    ingredients: meal.ingredients,
    kcal: meal.kcal,
    protein_g: meal.proteinG,
    carbs_g: meal.carbsG,
    fat_g: meal.fatG,
    fits_vegetarian: meal.fitsVegetarian,
    fits_vegan: meal.fitsVegan,
    fits_pescatarian: meal.fitsPescatarian,
    allergens: meal.allergens,
    steps: meal.steps,
    photo_url: meal.photoUrl,
    ...(input.published === undefined ? {} : { published: input.published }),
  };
  if (!input.id) {
    const { data, error } = await db.from("meals").insert(fields).select("id").single();
    if (error) throwWriteError(error, "create meal");
    return data.id;
  }
  const { data, error } = await db.from("meals").update(fields).eq("id", input.id).select("id");
  if (error) throwWriteError(error, "update meal");
  if (data.length === 0) throw new AppError("NOT_FOUND", NOT_FOUND);
  return input.id;
}

export async function setMealPublished(
  db: TypedClient,
  id: string,
  published: boolean,
): Promise<void> {
  const { data, error } = await db.from("meals").update({ published }).eq("id", id).select("id");
  if (error) throwWriteError(error, "publish meal");
  if (data.length === 0) throw new AppError("NOT_FOUND", NOT_FOUND);
}

export async function deleteMeal(db: TypedClient, id: string): Promise<void> {
  const { data, error } = await db.from("meals").delete().eq("id", id).select("id");
  if (error) throwWriteError(error, "delete meal");
  if (data.length === 0) throw new AppError("NOT_FOUND", NOT_FOUND);
}

/**
 * How many published meals each diet can eat per meal type (a meal with several types counts for each).
 * Allergens and avoided foods are personal, so they play no part here. Every cell is present, zero included.
 */
export function mealCoverage(meals: Meal[]): { diet: Diet; meal: MealSlot; count: number }[] {
  const published = meals.filter((meal) => meal.published);
  return DIETS.flatMap((diet) => {
    const fitting = published.filter((meal) =>
      mealFits(meal, { diet, allergens: [], avoidFoods: "", mealsPerDay: 3 }),
    );
    return MEAL_SLOTS.map((slot) => ({
      diet,
      meal: slot,
      count: fitting.filter((meal) => meal.mealTypes.includes(slot)).length,
    }));
  });
}

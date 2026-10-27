import { MEAL_SLOTS, type MealSlot } from "@/lib/nutrition/labels";
import type { Meal, MealInput } from "@/lib/nutrition/meal-schema";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedClient } from "@/server/db/types";

type MealRow = Database["public"]["Tables"]["meals"]["Row"];

/** Maps a stored row to the camelCase meal the engine and forms use. */
export const toMeal = (r: MealRow): Meal => ({
  id: r.id,
  title: r.title,
  // The database rejects „drinks“ for meals (meal_types_valid); narrowing keeps the type honest.
  mealTypes: r.meal_types.filter((t): t is MealSlot =>
    (MEAL_SLOTS as readonly string[]).includes(t),
  ),
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
  description: r.description,
  prepMin: r.prep_min,
  cookMin: r.cook_min,
  servings: r.servings,
  published: r.published,
});

/** One meal by id, published or not (the admin sees drafts through RLS). */
export async function getMeal(db: TypedClient, id: string): Promise<Meal | null> {
  const { data, error } = await db.from("meals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`load meal failed: ${error.message}`);
  return data ? toMeal(data) : null;
}

/** The published library a member's menu is built from (RLS shows it only to members with access). */
export async function listPublishedMeals(db: TypedClient): Promise<Meal[]> {
  const { data, error } = await db
    .from("meals")
    .select("*")
    .eq("published", true)
    .order("id")
    .limit(1000);
  if (error) throw new Error(`load meals failed: ${error.message}`);
  return data.map(toMeal);
}

/**
 * The menu dishes that are full recipes (they have steps) for Полезно → Рецепти: those with a photo
 * first, then the newest.
 * RLS shows members with access published meals only, so without access this is empty.
 */
export async function listRecipeMeals(db: TypedClient, limit = 24): Promise<Meal[]> {
  const { data, error } = await db
    .from("meals")
    .select("*")
    .eq("published", true)
    .neq("steps", "")
    // Recipes with a photo lead, so a batch of new photo-less dishes cannot push them off the list.
    .order("photo_url", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`load recipes failed: ${error.message}`);
  return data.map(toMeal);
}

/** One published meal by id; a draft reads as missing, even for an admin. */
export async function getPublishedMeal(db: TypedClient, id: string): Promise<Meal | null> {
  const meal = await getMeal(db, id);
  return meal?.published ? meal : null;
}

import { z } from "zod";
import { ALLERGENS, MEAL_SLOTS } from "./labels";

const macroG = z.number("Въведи число").min(0, "Между 0 и 1000 г").max(1000, "Между 0 и 1000 г");

// Same rule as article covers: local photos go through next/image, so no query string/fragment/space;
// https ones are served as-is.
const photoUrl = z.union(
  [
    z.literal(""),
    z
      .string()
      .trim()
      .max(500)
      .regex(/^(https:\/\/\S+|\/photos\/[A-Za-z0-9._/-]+)$/),
  ],
  "Снимката е https:// линк или /photos/…",
);

/** One ingredient of a meal: name and grams for the standard portion. */
export const mealIngredientSchema = z.object({
  name: z.string().trim().min(1, "Нужно е име").max(80, "До 80 знака"),
  grams: z.number("Въведи грамове").min(1, "Между 1 и 2000 г").max(2000, "Между 1 и 2000 г"),
});

/** Admin input for a meal (one standard portion); an empty photo means none. */
export const mealInputSchema = z.object({
  title: z.string().trim().min(2, "Поне 2 знака").max(120, "До 120 знака"),
  mealTypes: z
    .array(z.enum(MEAL_SLOTS))
    .min(1, "Избери поне един вид")
    .max(4)
    .refine((types) => new Set(types).size === types.length, "Видовете не се повтарят"),
  ingredients: z
    .array(mealIngredientSchema)
    .min(1, "Нужна е поне една съставка")
    .max(30, "До 30 съставки"),
  kcal: z
    .number("Въведи калориите")
    .int("Калориите са цяло число")
    .min(1, "Калориите са между 1 и 3000")
    .max(3000, "Калориите са между 1 и 3000"),
  proteinG: macroG,
  carbsG: macroG,
  fatG: macroG,
  fitsVegetarian: z.boolean(),
  fitsVegan: z.boolean(),
  fitsPescatarian: z.boolean(),
  allergens: z
    .array(z.enum(ALLERGENS))
    .refine((list) => new Set(list).size === list.length, "Алергените не се повтарят")
    .default([]),
  steps: z.string().max(10_000, "До 10 000 знака").default(""),
  photoUrl: photoUrl.nullish().transform((url) => url || null),
});

export type MealInput = z.infer<typeof mealInputSchema>;

/** A stored meal: the input plus its id and publication state. */
export type Meal = MealInput & { id: string; published: boolean };

/** The fields an AI draft may suggest; the title, steps, photo and publication state stay the admin's. */
export type MealDraft = Partial<
  Pick<
    MealInput,
    | "mealTypes"
    | "ingredients"
    | "kcal"
    | "proteinG"
    | "carbsG"
    | "fatG"
    | "allergens"
    | "fitsVegetarian"
    | "fitsVegan"
    | "fitsPescatarian"
  >
>;

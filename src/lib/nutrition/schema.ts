import { z } from "zod";
import { ACTIVITY_LEVELS, ALLERGENS, DIETS } from "./labels";

const macroG = z.number().min(0).max(1000);

/** One food inside an AI estimate; kcal is rounded to a whole number. */
export const estimateItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  grams: z.number().min(1).max(2000),
  kcal: z
    .number()
    .min(0)
    .max(3000)
    .transform((kcal) => Math.round(kcal)),
  proteinG: macroG,
  carbsG: macroG,
  fatG: macroG,
});

export type EstimateItem = z.infer<typeof estimateItemSchema>;

/** AI estimate output: at most 12 items. */
export const estimateSchema = z.object({
  items: z.array(estimateItemSchema).max(12),
});

/** Manual diary entry; kcal is a whole number and macros are optional. */
export const manualEntrySchema = z.object({
  name: z.string().trim().min(1).max(120),
  kcal: z.number().int().min(0).max(5000),
  proteinG: macroG.optional(),
  carbsG: macroG.optional(),
  fatG: macroG.optional(),
});

/** Free-text food description sent for estimation. */
export const foodTextSchema = z.string().trim().min(2).max(300);

/** Onboarding answers; birth year must be at least 16 years before `todayYear` (Sofia year). */
export function nutritionAnswersSchema(todayYear: number) {
  return z.object({
    birthYear: z
      .number()
      .int()
      .min(1940)
      .max(todayYear - 16),
    activity: z.enum(ACTIVITY_LEVELS),
    diet: z.enum(DIETS),
    allergens: z.array(z.enum(ALLERGENS)),
    avoidFoods: z.string().trim().max(200),
    mealsPerDay: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  });
}

export type NutritionAnswers = z.infer<ReturnType<typeof nutritionAnswersSchema>>;

import { z } from "zod";
import { ACTIVITY_LEVELS, ALLERGENS, DIETS } from "./labels";

const grams = z.number().min(0);

/** One food inside an AI estimate. */
export const estimateItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  grams: z.number().min(1).max(2000),
  kcal: z.number().min(0).max(3000),
  proteinG: grams,
  carbsG: grams,
  fatG: grams,
});

export type EstimateItem = z.infer<typeof estimateItemSchema>;

/** AI estimate output: at most 12 items. */
export const estimateSchema = z.object({
  items: z.array(estimateItemSchema).max(12),
});

/** Manual diary entry; macros are optional. */
export const manualEntrySchema = z.object({
  name: z.string().trim().min(1).max(120),
  kcal: z.number().min(0).max(5000),
  proteinG: grams.optional(),
  carbsG: grams.optional(),
  fatG: grams.optional(),
});

/** Free-text food description sent for estimation. */
export const foodTextSchema = z.string().trim().min(2).max(300);

/** Onboarding answers for the nutrition profile. Birth year must be at least 16 years ago. */
export const nutritionAnswersSchema = z.object({
  birthYear: z
    .number()
    .int()
    .min(1940)
    .max(new Date().getFullYear() - 16),
  activity: z.enum(ACTIVITY_LEVELS),
  diet: z.enum(DIETS),
  allergens: z.array(z.enum(ALLERGENS)),
  avoidFoods: z.string().trim().max(200),
  mealsPerDay: z.union([z.literal(3), z.literal(4), z.literal(5)]),
});

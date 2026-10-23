"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { nutritionFormToAnswers } from "@/lib/nutrition/answers-form";
import { parseDayParam } from "@/lib/nutrition/day-param";
import { MEAL_SLOTS } from "@/lib/nutrition/labels";
import {
  foodTextSchema,
  manualEntrySchema,
  nutritionAnswersSchema,
  type EstimateItem,
} from "@/lib/nutrition/schema";
import { sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import type { TypedClient } from "@/server/db/types";
import {
  addEntries,
  deleteEntry,
  saveNutritionAnswers,
  updateEntryGrams,
} from "@/server/nutrition/diary";
import { createClaudeEstimator, EstimateFailed } from "@/server/nutrition/estimator";

const DEFAULT_MODEL = "claude-opus-5-5";

/** Estimates calories from a free-text description. Spends one of the member's daily estimates. */
export async function estimateFood(input: {
  text: string;
}): Promise<ActionResult<{ items: EstimateItem[] }>> {
  try {
    const { supabase } = await requireUser();

    const text = foodTextSchema.safeParse(input?.text);
    if (!text.success) throw new AppError("INVALID", "Опиши храната с няколко думи.");

    const apiKey = serverEnv.ANTHROPIC_API_KEY;
    if (!apiKey) throw new AppError("INVALID", "Изчисляването с думи скоро ще е включено.");

    // Claimed only now, so invalid input or a missing key never burns the quota.
    // False also covers "no access"; the page does not show the field then.
    const { data: claimed, error } = await supabase.rpc("claim_nutrition_ai_call");
    if (error) throw error;
    if (!claimed)
      throw new AppError("INVALID", "Днес достигна лимита за изчисления. Въведи ръчно.");

    const estimator = createClaudeEstimator({
      apiKey,
      model: serverEnv.NUTRITION_AI_MODEL ?? DEFAULT_MODEL,
    });
    try {
      return actionOk({ items: await estimator.estimate(text.data) });
    } catch (failure) {
      if (!(failure instanceof EstimateFailed)) throw failure;
      // Never log the member's text; the cause is an SDK or validation error.
      console.error(
        "nutrition estimate failed",
        failure.cause instanceof Error ? failure.cause.message : failure.message,
      );
      throw new AppError("INVALID", "Не успяхме да изчислим. Опитай пак или въведи ръчно.");
    }
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * Saves her nutrition answers (the profile card and the first visit to the diary). No access check on
 * purpose: correcting answers is harmless for a lapsed member, and writing the diary stays gated.
 */
export async function saveNutritionAnswersAction(form: FormData): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    const answers = nutritionAnswersSchema(Number(sofiaToday().slice(0, 4))).parse(
      nutritionFormToAnswers(form),
    );
    await saveNutritionAnswers(supabase, user.id, answers);
    revalidatePath("/app/profile");
    revalidatePath("/app/nutrition");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * Writes need an active plan. RLS would hide the write anyway (the row would look "not found"), so the
 * member is told the real reason first.
 */
async function requireDiaryAccess(supabase: TypedClient): Promise<void> {
  const { data, error } = await supabase.rpc("my_access");
  if (error) throw error;
  if (data !== true) throw new AppError("INVALID", "Нужен е активен абонамент.");
}

/** The days the diary accepts (today back to 365 days ago, Sofia); anything else is not a day to write to. */
function assertDiaryDay(day: unknown): string {
  const today = sofiaToday();
  if (typeof day !== "string" || parseDayParam(day, today) !== day) {
    throw new AppError("INVALID", "Невалиден ден.");
  }
  return day;
}

const manualInputSchema = manualEntrySchema.extend({
  meal: z.enum(MEAL_SLOTS),
  batchId: z.guid("Невалидни данни за записа."),
});

/** Saves one hand-typed food. The batch id makes a retried request a no-op. Missing macros count as 0. */
export async function addManualEntry(input: {
  day: string;
  meal: (typeof MEAL_SLOTS)[number];
  batchId: string;
  name: string;
  kcal: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    const day = assertDiaryDay(input?.day);
    const entry = manualInputSchema.parse(input);
    await requireDiaryAccess(supabase);
    await addEntries(supabase, user.id, {
      day,
      meal: entry.meal,
      batchId: entry.batchId,
      source: "manual",
      items: [
        {
          name: entry.name,
          grams: null,
          kcal: entry.kcal,
          proteinG: entry.proteinG ?? 0,
          carbsG: entry.carbsG ?? 0,
          fatG: entry.fatG ?? 0,
        },
      ],
    });
    revalidateDiary();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

const updateInputSchema = z.object({
  id: z.guid("Записът не е намерен."),
  grams: z.number("Въведи количество").finite("Въведи количество"),
});

/** Changes the amount of an entry; kcal and macros scale with it. Bounds are checked by the service. */
export async function updateEntry(input: {
  id: string;
  grams: number;
}): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    const { id, grams } = updateInputSchema.parse(input);
    await requireDiaryAccess(supabase);
    await updateEntryGrams(supabase, id, grams);
    revalidateDiary();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteEntryAction(input: { id: string }): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    const { id } = z.object({ id: z.guid("Записът не е намерен.") }).parse(input);
    await requireDiaryAccess(supabase);
    await deleteEntry(supabase, id);
    revalidateDiary();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

/** The diary and the Начало card (today's total) both show entries. */
function revalidateDiary() {
  revalidatePath("/app/nutrition");
  revalidatePath("/app");
}

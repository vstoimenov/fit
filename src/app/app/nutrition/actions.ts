"use server";

import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { foodTextSchema, type EstimateItem } from "@/lib/nutrition/schema";
import { requireUser } from "@/server/auth/require-user";
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

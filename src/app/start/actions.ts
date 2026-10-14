"use server";

import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";
import { saveOnboarding } from "@/server/onboarding/save-onboarding";

export async function completeOnboarding(
  raw: unknown,
): Promise<ActionResult<{ freeWorkoutId: string }>> {
  try {
    const { user, supabase } = await requireUser();
    return actionOk(await saveOnboarding(supabase, user.id, raw));
  } catch (error) {
    return actionFail(error);
  }
}

"use server";

import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";
import { saveContact } from "@/server/onboarding/save-contact";
import { saveOnboarding } from "@/server/onboarding/save-onboarding";

export async function completeOnboarding(
  raw: unknown,
): Promise<ActionResult<{ freeWorkoutId: string | null }>> {
  try {
    const { user, supabase } = await requireUser();
    return actionOk(await saveOnboarding(supabase, user.id, raw));
  } catch (error) {
    return actionFail(error);
  }
}

/** The phone from the sign-up (or, after Google, the phone) screen, saved before the questions. */
export async function saveContactAction(raw: unknown): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    await saveContact(supabase, user.id, raw);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

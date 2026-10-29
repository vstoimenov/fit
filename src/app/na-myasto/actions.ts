"use server";

import { actionFail } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { bookStudioSession, cancelStudioBooking } from "@/server/studio/booking";
import { claimStudioInvite } from "@/server/studio/invite";
import { joinStudio } from "@/server/studio/join";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

/** Right after sign-up on /na-myasto: her name and phone, and she is now an in-person client. */
export async function joinAction(input: { name: string; phone: string }): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    return await joinStudio(supabase, input);
  } catch (error) {
    return actionFail(error);
  }
}

export async function bookAction(sessionId: string): Promise<Result<{ cardId: string | null }>> {
  try {
    const { supabase } = await requireUser();
    return await bookStudioSession(supabase, String(sessionId));
  } catch (error) {
    return actionFail(error);
  }
}

export async function cancelAction(bookingId: string): Promise<Result> {
  try {
    const { supabase } = await requireUser();
    return await cancelStudioBooking(supabase, String(bookingId));
  } catch (error) {
    return actionFail(error);
  }
}

/** The invite token is the proof: the service role writes her e-mail and password. */
export async function claimAction(
  token: string,
  input: { email: string; password: string },
): Promise<Result<{ email: string }>> {
  try {
    return await claimStudioInvite(createAdminSupabaseClient(), String(token), input);
  } catch (error) {
    return actionFail(error);
  }
}

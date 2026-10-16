"use server";

import { redirect } from "next/navigation";
import { actionFail, type ActionResult } from "@/lib/action-result";
import { checkInSchema } from "@/lib/progress/check-in-schema";
import { requireUser } from "@/server/auth/require-user";
import { addCheckIn } from "@/server/profile/profile";

/** A failed submit also returns what was typed, so the form can keep it. */
export type CheckInResult = ActionResult<null> & { values?: Record<string, string> };

export async function saveCheckIn(_prev: unknown, form: FormData): Promise<CheckInResult> {
  const raw = Object.fromEntries(form);
  try {
    const { supabase } = await requireUser();
    await addCheckIn(supabase, checkInSchema.parse(raw));
  } catch (error) {
    const values = Object.fromEntries(
      Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
    return { ...actionFail(error), values };
  }
  redirect("/app/progress?saved=1");
}

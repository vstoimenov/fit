"use server";

import { redirect } from "next/navigation";
import { actionFail, type ActionResult } from "@/lib/action-result";
import { checkInSchema } from "@/lib/progress/check-in-schema";
import { requireUser } from "@/server/auth/require-user";
import { addCheckIn } from "@/server/profile/profile";

export async function saveCheckIn(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    await addCheckIn(supabase, checkInSchema.parse(Object.fromEntries(form)));
  } catch (error) {
    return actionFail(error);
  }
  redirect("/app/profile?saved=1");
}

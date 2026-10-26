"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";
import { attendLive } from "@/server/live/sessions";

/** „Влизам": records attendance (5 points once); the link itself opens in the browser. */
export async function attendLiveAction(sessionId: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    const result = await attendLive(supabase, z.uuid().parse(sessionId));
    if (!result.ok) return { ok: false, message: result.message };
    revalidatePath("/app");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

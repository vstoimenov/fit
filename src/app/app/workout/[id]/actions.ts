"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";
import {
  getCompletionStats,
  markWorkoutComplete,
  setCompletionFeeling,
  type CompletionStats,
} from "@/server/content/completion";

export async function completeWorkout(
  workoutId: string,
): Promise<ActionResult<{ completionId: string } & CompletionStats>> {
  try {
    const { user, supabase } = await requireUser();
    const { completionId } = await markWorkoutComplete(
      supabase,
      user.id,
      z.uuid().parse(workoutId),
    );
    revalidatePath("/app");
    // Presentation only: the same numbers Днес shows, read after the completion is saved.
    const stats = await getCompletionStats(supabase, user.id);
    return actionOk({ completionId, ...stats });
  } catch (error) {
    return actionFail(error);
  }
}

export async function rateWorkout(
  completionId: string,
  feeling: string,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    await setCompletionFeeling(
      supabase,
      z.uuid().parse(completionId),
      z.enum(["easy", "right", "hard"]).parse(feeling),
    );
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

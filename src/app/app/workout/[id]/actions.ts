"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import type { CompletionPoints } from "@/lib/points/copy";
import { requireUser } from "@/server/auth/require-user";
import {
  getCompletionStats,
  markWorkoutComplete,
  setCompletionFeeling,
  type CompletionStats,
} from "@/server/content/completion";
import { getMemberPoints, type MemberPoints } from "@/server/content/points";

/** Presentation only: a failed points read must never fail (or hide) a saved completion. */
async function readPoints(
  supabase: Parameters<typeof getMemberPoints>[0],
  userId: string,
  when: "before" | "after",
): Promise<MemberPoints | null> {
  try {
    return await getMemberPoints(supabase, userId);
  } catch (error) {
    console.error(
      `points read ${when} completion failed`,
      { userId },
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function completeWorkout(workoutId: string): Promise<
  ActionResult<{
    completionId: string;
    stats: CompletionStats | null;
    points: CompletionPoints | null;
  }>
> {
  try {
    const { user, supabase } = await requireUser();
    const id = z.uuid().parse(workoutId);
    // The award is made by a database trigger, so "gained" is the difference around the completion.
    const pointsBefore = await readPoints(supabase, user.id, "before");
    const { completionId } = await markWorkoutComplete(supabase, user.id, id);
    revalidatePath("/app");
    // Presentation only: the completion is already saved, so a failed stats read must not fail it.
    let stats: CompletionStats | null = null;
    try {
      stats = await getCompletionStats(supabase, user.id);
    } catch (error) {
      console.error(
        "completion stats failed",
        { userId: user.id, completionId },
        error instanceof Error ? error.message : error,
      );
    }
    const pointsAfter = pointsBefore ? await readPoints(supabase, user.id, "after") : null;
    const points =
      pointsBefore && pointsAfter
        ? {
            total: pointsAfter.points,
            level: pointsAfter.level,
            gained: pointsAfter.points - pointsBefore.points,
            levelUp: pointsAfter.level > pointsBefore.level,
          }
        : null;
    return actionOk({ completionId, stats, points });
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

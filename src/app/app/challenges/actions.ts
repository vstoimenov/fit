"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { requireUser } from "@/server/auth/require-user";
import { joinChallenge, setBoardVisibility, setTick } from "@/server/challenges/challenges";
import type { TypedClient } from "@/server/db/types";

const idSchema = z.guid("Невалидно предизвикателство.");
const tickSchema = z.object({
  id: idSchema,
  day: z
    .number("Невалиден ден.")
    .int("Невалиден ден.")
    .min(1, "Невалиден ден.")
    .max(60, "Невалиден ден."),
  done: z.boolean("Невалидни данни."),
});
const boardSchema = z.object({ id: idSchema, show: z.boolean("Невалидни данни.") });

/**
 * Joining and ticking need an active plan. The database refuses without one too, but the member is told the
 * real reason first (RLS alone would make the row look "not found").
 */
async function requireChallengeAccess(supabase: TypedClient): Promise<void> {
  const { data, error } = await supabase.rpc("my_access");
  if (error) throw error;
  if (data !== true) throw new AppError("INVALID", "Нужен е активен абонамент.");
}

function revalidateChallenge() {
  revalidatePath("/app/challenges");
  revalidatePath("/app/challenges/[id]", "page");
  revalidatePath("/app");
}

/** Includes her in a challenge that has not ended. Joining twice changes nothing. */
export async function joinChallengeAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    const challengeId = idSchema.parse(id);
    await requireChallengeAccess(supabase);
    await joinChallenge(supabase, challengeId);
    revalidateChallenge();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

/** Ticks (done) or unticks one day: today or yesterday only; the first tick of a day earns the points (`points` says whether this call did). */
export async function toggleTickAction(input: {
  id: string;
  day: number;
  done: boolean;
}): Promise<ActionResult<{ points: boolean }>> {
  try {
    const { user, supabase } = await requireUser();
    const parsed = tickSchema.parse(input);
    await requireChallengeAccess(supabase);
    const { points } = await setTick(supabase, user.id, parsed);
    revalidateChallenge();
    return actionOk({ points });
  } catch (error) {
    return actionFail(error);
  }
}

/**
 * Shows or hides her name on the leaderboard. No access check on purpose: a member whose plan has lapsed can
 * still take her name off the board (the database allows it too).
 */
export async function setBoardVisibilityAction(input: {
  id: string;
  show: boolean;
}): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    const parsed = boardSchema.parse(input);
    await setBoardVisibility(supabase, user.id, parsed);
    revalidatePath("/app/challenges/[id]", "page");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

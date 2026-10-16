import { z } from "zod";
import { toShareCard, type ShareCard } from "@/lib/share/share-card";
import { getCompletionStats } from "@/server/content/completion";
import type { TypedClient } from "@/server/db/types";

/**
 * The share card for one of her own completions, or null. `db` must be her session client:
 * RLS hides other members' completions, so their ids read as unknown. Only the workout title
 * and the streak/week numbers are read; nothing from the profile reaches the card.
 */
export async function getShareCard(
  db: TypedClient,
  userId: string,
  completionId: string,
): Promise<ShareCard | null> {
  if (!z.uuid().safeParse(completionId).success) return null;
  const { data, error } = await db
    .from("workout_completions")
    .select("id, workouts(title)")
    .eq("id", completionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`load completion failed: ${error.message}`);
  if (!data?.workouts) return null;

  const stats = await getCompletionStats(db, userId);
  return toShareCard({ workoutTitle: data.workouts.title, ...stats });
}

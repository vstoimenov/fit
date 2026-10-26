import { AppError } from "@/lib/app-error";
import type { TypedClient } from "@/server/db/types";

/**
 * „Гледано": the member's own mark on a workout, separate from the points-earning completion.
 * Marking twice is a no-op; RLS keeps every call to her own rows.
 */
export async function setWatched(db: TypedClient, workoutId: string, watched: boolean) {
  if (watched) {
    const { error } = await db.from("workout_watches").insert({ workout_id: workoutId });
    if (!error || error.code === "23505") return;
    if (error.code === "42501") {
      throw new AppError("FORBIDDEN", "Тази тренировка се отключва с абонамент.");
    }
    throw new Error(`watch failed: ${error.message}`);
  }
  const { error } = await db.from("workout_watches").delete().eq("workout_id", workoutId);
  if (error) throw new Error(`unwatch failed: ${error.message}`);
}

/** Ids of the workouts this member marked. Filtered by user because admins can read every row. */
export async function listWatchedIds(db: TypedClient, userId: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("workout_watches")
    .select("workout_id")
    .eq("user_id", userId);
  if (error) throw new Error(`list watches failed: ${error.message}`);
  return new Set(data.map((row) => row.workout_id));
}

export async function isWatched(
  db: TypedClient,
  userId: string,
  workoutId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("workout_watches")
    .select("workout_id")
    .eq("user_id", userId)
    .eq("workout_id", workoutId)
    .maybeSingle();
  if (error) throw new Error(`read watch failed: ${error.message}`);
  return data !== null;
}

/** Display-only read: a failed read logs and shows nothing watched instead of failing the page. */
export async function listWatchedIdsOrEmpty(db: TypedClient, userId: string): Promise<Set<string>> {
  try {
    return await listWatchedIds(db, userId);
  } catch (error) {
    console.error(
      "watched list failed",
      { userId },
      error instanceof Error ? error.message : error,
    );
    return new Set();
  }
}

export async function isWatchedOrFalse(
  db: TypedClient,
  userId: string,
  workoutId: string,
): Promise<boolean> {
  try {
    return await isWatched(db, userId, workoutId);
  } catch (error) {
    console.error(
      "watched read failed",
      { userId },
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

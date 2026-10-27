import type { Level } from "@/lib/program/types";
import { parseVideoUrl, type VideoRef } from "@/lib/video/parse-video-url";
import type { TypedClient } from "@/server/db/types";
import { getMemberLevel } from "./member";
import { toSummary, WORKOUT_COLUMNS, type WorkoutSummary } from "./today";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PlayerView =
  | { workout: WorkoutSummary; state: "ok"; video: VideoRef }
  | { workout: WorkoutSummary; state: "locked" }
  | { workout: WorkoutSummary; state: "broken" };

/** Workout metadata plus its embed when the viewer may watch it. RLS decides both. */
export async function getWorkoutForPlayer(
  db: TypedClient,
  workoutId: string,
): Promise<PlayerView | null> {
  if (!UUID.test(workoutId)) return null;
  const [{ data: row, error: rowError }, { data: media, error: mediaError }] = await Promise.all([
    db.from("workouts").select(WORKOUT_COLUMNS).eq("id", workoutId).maybeSingle(),
    db.from("workout_media").select("video_url").eq("workout_id", workoutId).maybeSingle(),
  ]);
  if (rowError) throw new Error(`load workout failed: ${rowError.message}`);
  if (mediaError) throw new Error(`load workout media failed: ${mediaError.message}`);
  if (!row) return null;
  const workout = toSummary(row);
  if (!media) return { workout, state: "locked" };
  const ref = parseVideoUrl(media.video_url);
  return ref ? { workout, state: "ok", video: ref } : { workout, state: "broken" };
}

/**
 * Every published workout, newest first. The publish filter is explicit because RLS also lets
 * admins read drafts and scheduled workouts.
 */
export async function listPublishedWorkouts(db: TypedClient): Promise<WorkoutSummary[]> {
  const { data, error } = await db
    .from("workouts")
    .select(WORKOUT_COLUMNS)
    .not("publish_at", "is", null)
    .lte("publish_at", new Date().toISOString())
    .order("publish_at", { ascending: false });
  if (error) throw new Error(`list workouts failed: ${error.message}`);
  return data.map(toSummary);
}

/**
 * The library for one member: published workouts, with regular ones narrowed to the member's own
 * level (free and starter/intro workouts have no level and stay listed). Falls back to beginner
 * when the profile is missing or holds an unexpected level.
 */
export async function getLibrary(
  db: TypedClient,
  userId: string,
): Promise<{ level: Level; workouts: WorkoutSummary[] }> {
  // Both reads start together; the level narrows the regular workouts afterwards (a few dozen rows),
  // which saves a round trip on every visit to the library.
  const [level, all] = await Promise.all([getMemberLevel(db, userId), listPublishedWorkouts(db)]);
  return { level, workouts: all.filter((w) => w.kind !== "regular" || w.level === level) };
}

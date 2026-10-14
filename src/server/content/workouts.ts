import { parseVideoUrl } from "@/lib/video/parse-video-url";
import type { TypedClient } from "@/server/db/types";
import { toSummary, WORKOUT_COLUMNS, type WorkoutSummary } from "./today";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PlayerView =
  | { workout: WorkoutSummary; state: "ok"; embedUrl: string }
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
  return ref ? { workout, state: "ok", embedUrl: ref.embedUrl } : { workout, state: "broken" };
}

/** Every published workout the viewer can see, newest first. */
export async function listPublishedWorkouts(db: TypedClient): Promise<WorkoutSummary[]> {
  const { data, error } = await db
    .from("workouts")
    .select(WORKOUT_COLUMNS)
    .order("publish_at", { ascending: false });
  if (error) throw new Error(`list workouts failed: ${error.message}`);
  return data.map(toSummary);
}

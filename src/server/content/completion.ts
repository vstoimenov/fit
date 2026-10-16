import { AppError } from "@/lib/app-error";
import { completionStats, regularSlotDates } from "@/lib/program/completion-stats";
import { toLocalDate } from "@/lib/program/dates";
import type { TypedClient } from "@/server/db/types";

type Feeling = "easy" | "right" | "hard";

/** Records „Завърших". A second tap the same day returns the existing completion. */
export async function markWorkoutComplete(
  db: TypedClient,
  userId: string,
  workoutId: string,
): Promise<{ status: "done" | "already"; completionId: string }> {
  const inserted = await db
    .from("workout_completions")
    .insert({ workout_id: workoutId })
    .select("id")
    .single();
  if (!inserted.error) return { status: "done", completionId: inserted.data.id };

  if (inserted.error.code === "23505") {
    const { data } = await db
      .from("workout_completions")
      .select("id")
      .eq("user_id", userId)
      .eq("workout_id", workoutId)
      .order("local_date", { ascending: false })
      .order("completed_at", { ascending: false })
      .limit(1)
      .single();
    if (data) return { status: "already", completionId: data.id };
  }
  if (inserted.error.code === "42501") {
    throw new AppError("FORBIDDEN", "Тази тренировка се отключва с абонамент.");
  }
  throw new Error(`complete workout failed: ${inserted.error.message}`);
}

export async function setCompletionFeeling(
  db: TypedClient,
  completionId: string,
  feeling: Feeling,
): Promise<void> {
  const { error } = await db.from("workout_completions").update({ feeling }).eq("id", completionId);
  if (error) throw new Error(`set feeling failed: ${error.message}`);
}

export interface CompletionStats {
  streakDays: number;
  weekDone: number;
  weekTarget: number;
}

/**
 * Streak and week progress (done days and target) for the after-workout screen. Read-only;
 * built with `completionStats` and `regularSlotDates`, the same helpers `getTodayView` uses,
 * so both screens agree.
 */
export async function getCompletionStats(
  db: TypedClient,
  userId: string,
  now = new Date(),
): Promise<CompletionStats> {
  const [profileRes, workoutsRes, completionsRes] = await Promise.all([
    db.from("profiles").select("level, timezone").eq("id", userId).single(),
    db
      .from("workouts")
      .select("kind, level, publish_at")
      .not("publish_at", "is", null)
      .lte("publish_at", now.toISOString()),
    db.from("workout_completions").select("local_date").eq("user_id", userId),
  ]);
  if (profileRes.error) throw new Error(`load profile failed: ${profileRes.error.message}`);
  if (workoutsRes.error) throw new Error(`load workouts failed: ${workoutsRes.error.message}`);
  if (completionsRes.error) {
    throw new Error(`load completions failed: ${completionsRes.error.message}`);
  }
  const { level, timezone } = profileRes.data;
  return completionStats({
    slotDates: regularSlotDates(
      workoutsRes.data.map((w) => ({ kind: w.kind, level: w.level, publishAt: w.publish_at })),
      level,
      timezone,
    ),
    completionDates: completionsRes.data.map((c) => c.local_date),
    today: toLocalDate(now, timezone),
  });
}

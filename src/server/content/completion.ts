import { AppError } from "@/lib/app-error";
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

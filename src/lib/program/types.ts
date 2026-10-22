export type Level = "beginner" | "advanced" | "pro";
export type WorkoutKind = "free" | "starter" | "regular";

/** The fields program logic needs; dates are ISO strings. */
export interface WorkoutLite {
  id: string;
  kind: WorkoutKind;
  level: Level | null;
  starterOrder: number | null;
  publishAt: string | null;
  /** Set on exclusive (bonus library) workouts; they are never part of the day's plan. */
  minMemberLevel?: number | null;
}

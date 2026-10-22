import type { Level, WorkoutLite } from "./types";

export type TodayPick =
  | { kind: "free"; workoutId: string }
  | { kind: "starter"; workoutId: string; index: number; total: number }
  | { kind: "regular"; workoutId: string }
  | { kind: "rest" }
  | { kind: "locked" };

export function isPublished(w: WorkoutLite, now: Date): boolean {
  return w.publishAt !== null && Date.parse(w.publishAt) <= now.getTime();
}

/** The one workout the Today screen leads with (spec §4 "Днешната тренировка"). */
export function pickToday(input: {
  level: Level;
  hasAccess: boolean;
  starterWeekDone: boolean;
  now: Date;
  workouts: WorkoutLite[];
  completedIds: ReadonlySet<string>;
}): TodayPick {
  // Exclusive workouts are bonus library content, never the day's plan.
  const published = input.workouts.filter(
    (w) => isPublished(w, input.now) && (w.minMemberLevel ?? null) === null,
  );

  if (!input.hasAccess) {
    const free = published.find((w) => w.kind === "free");
    return free && !input.completedIds.has(free.id)
      ? { kind: "free", workoutId: free.id }
      : { kind: "locked" };
  }

  if (!input.starterWeekDone) {
    const starters = published
      .filter((w) => w.kind === "starter")
      .sort((a, b) => (a.starterOrder ?? 0) - (b.starterOrder ?? 0));
    const index = starters.findIndex((w) => !input.completedIds.has(w.id));
    if (index !== -1) {
      return {
        kind: "starter",
        workoutId: starters[index]!.id,
        index: index + 1,
        total: starters.length,
      };
    }
  }

  const next = published
    .filter((w) => w.kind === "regular" && w.level === input.level && !input.completedIds.has(w.id))
    .sort((a, b) => Date.parse(b.publishAt!) - Date.parse(a.publishAt!))[0];
  return next ? { kind: "regular", workoutId: next.id } : { kind: "rest" };
}

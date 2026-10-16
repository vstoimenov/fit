import { toLocalDate, weekStrip } from "./dates";
import { computeStreak } from "./streak";
import type { Level, WorkoutKind } from "./types";

/** Used when no workout is scheduled in the current week. */
export const DEFAULT_WEEK_TARGET = 5;

/** Local dates on which a regular workout of `level` was published (the member's „слотове“). */
export function regularSlotDates(
  workouts: Array<{ kind: WorkoutKind; level: Level | null; publishAt: string | null }>,
  level: Level,
  timeZone: string,
): string[] {
  return workouts
    .filter((w) => w.kind === "regular" && w.level === level && w.publishAt)
    .map((w) => toLocalDate(w.publishAt!, timeZone));
}

/** The numbers the after-workout screen shows; same sources as the Днес screen. */
export function completionStats(input: {
  slotDates: string[];
  completionDates: string[];
  today: string;
}): { streakDays: number; weekDone: number; weekTarget: number } {
  const week = weekStrip(input.today, input.completionDates, input.slotDates);
  const weekTarget = week.filter((d) => d.slot).length || DEFAULT_WEEK_TARGET;
  const weekDone = Math.min(weekTarget, week.filter((d) => d.done).length);
  return { streakDays: computeStreak(input), weekDone, weekTarget };
}

/** „N тренировки“ for the Днес series tile; `computeStreak` counts workouts, not days. */
export function seriesText(n: number): string {
  if (n <= 0) return "0";
  return n === 1 ? "1 тренировка" : `${n} тренировки`;
}

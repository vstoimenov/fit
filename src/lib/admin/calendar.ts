import type { Level } from "@/lib/program/types";
import { addDays, weekdayOf } from "./time";

export type WorkoutStatus = "draft" | "scheduled" | "published";

export function workoutStatus(publishAt: string | null, now: Date): WorkoutStatus {
  if (publishAt === null) return "draft";
  return Date.parse(publishAt) > now.getTime() ? "scheduled" : "published";
}

export function weekOf(date: string): string[] {
  const monday = addDays(date, -weekdayOf(date));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Monday-first weeks covering the whole month (month is 1-12). */
export function monthGrid(year: number, month: number): string[][] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const weeks: string[][] = [];
  for (let start = weekOf(first)[0]!; start <= last; start = addDays(start, 7)) {
    weeks.push(weekOf(start));
  }
  return weeks;
}

const LEVELS: Level[] = ["beginner", "advanced", "pro"];

/** Levels whose newest regular workout goes live before now + horizonDays (or that have none). */
export function levelGaps(
  items: { kind: string; level: Level | null; publishAt: string | null }[],
  now: Date,
  horizonDays = 7,
): { level: Level; lastAt: string | null }[] {
  const horizon = now.getTime() + horizonDays * 86_400_000;
  return LEVELS.flatMap((level) => {
    const times = items
      .filter((i) => i.kind === "regular" && i.level === level && i.publishAt)
      .map((i) => i.publishAt!);
    const lastAt = times.sort().at(-1) ?? null;
    return lastAt === null || Date.parse(lastAt) < horizon ? [{ level, lastAt }] : [];
  });
}

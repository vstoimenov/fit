import { FOCUS, type Focus } from "@/lib/labels";
import type { WorkoutSummary } from "@/server/content/today";
import type { Level } from "./types";

export interface LibraryFilter {
  level?: Level;
  length?: "short" | "mid" | "long";
  focus?: Focus;
}

const LEVELS: readonly Level[] = ["beginner", "advanced", "pro"];
const LENGTHS = ["short", "mid", "long"] as const;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export function parseLibraryFilter(
  params: Record<string, string | string[] | undefined>,
): LibraryFilter {
  const filter: LibraryFilter = {};
  const level = one(params.level);
  const length = one(params.length);
  const focus = one(params.focus);
  if (level && (LEVELS as readonly string[]).includes(level)) filter.level = level as Level;
  if (length && (LENGTHS as readonly string[]).includes(length))
    filter.length = length as LibraryFilter["length"];
  if (focus && (FOCUS as readonly string[]).includes(focus)) filter.focus = focus as Focus;
  return filter;
}

function lengthOf(min: number): LibraryFilter["length"] {
  return min <= 15 ? "short" : min <= 30 ? "mid" : "long";
}

export function filterLibrary(workouts: WorkoutSummary[], f: LibraryFilter): WorkoutSummary[] {
  return workouts.filter(
    (w) =>
      (!f.level || w.level === f.level) &&
      (!f.length || lengthOf(w.durationMin) === f.length) &&
      (!f.focus || w.focus.includes(f.focus)),
  );
}

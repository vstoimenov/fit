import { FOCUS, type Focus } from "@/lib/labels";
import type { WorkoutSummary } from "@/server/content/today";

export interface LibraryFilter {
  length?: "short" | "mid" | "long";
  focus?: Focus;
}

const LENGTHS = ["short", "mid", "long"] as const;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Only duration and focus are filterable; a stale `?level=` is ignored (the member's level decides). */
export function parseLibraryFilter(
  params: Record<string, string | string[] | undefined>,
): LibraryFilter {
  const filter: LibraryFilter = {};
  const length = one(params.length);
  const focus = one(params.focus);
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
      (!f.length || lengthOf(w.durationMin) === f.length) &&
      (!f.focus || w.focus.includes(f.focus)),
  );
}

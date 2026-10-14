import { describe, expect, it } from "vitest";
import { pickToday } from "./pick-today";
import type { WorkoutLite } from "./types";

const now = new Date("2026-10-14T10:00:00Z");
const past = "2026-10-01T07:00:00Z";
const w = (over: Partial<WorkoutLite> & Pick<WorkoutLite, "id">): WorkoutLite => ({
  kind: "regular",
  level: "beginner",
  starterOrder: null,
  publishAt: past,
  ...over,
});

const catalog: WorkoutLite[] = [
  w({ id: "free", kind: "free", level: null }),
  w({ id: "s2", kind: "starter", level: null, starterOrder: 2 }),
  w({ id: "s1", kind: "starter", level: null, starterOrder: 1 }),
  w({ id: "old", publishAt: "2026-10-08T07:00:00Z" }),
  w({ id: "new", publishAt: "2026-10-13T07:00:00Z" }),
  w({ id: "future", publishAt: "2026-10-20T07:00:00Z" }),
  w({ id: "pro", level: "pro", publishAt: "2026-10-14T07:00:00Z" }),
];

const base = {
  level: "beginner" as const,
  hasAccess: true,
  starterWeekDone: true,
  now,
  workouts: catalog,
};

describe("pickToday", () => {
  it("offers the free workout to a user without access", () => {
    expect(pickToday({ ...base, hasAccess: false, completedIds: new Set() })).toEqual({
      kind: "free",
      workoutId: "free",
    });
  });

  it("locks a user without access once the free workout is done", () => {
    expect(pickToday({ ...base, hasAccess: false, completedIds: new Set(["free"]) })).toEqual({
      kind: "locked",
    });
  });

  it("walks the starter week in order", () => {
    const input = { ...base, starterWeekDone: false };
    expect(pickToday({ ...input, completedIds: new Set() })).toEqual({
      kind: "starter",
      workoutId: "s1",
      index: 1,
      total: 2,
    });
    expect(pickToday({ ...input, completedIds: new Set(["s1"]) })).toEqual({
      kind: "starter",
      workoutId: "s2",
      index: 2,
      total: 2,
    });
  });

  it("moves to the newest unfinished workout of the user's level", () => {
    expect(pickToday({ ...base, completedIds: new Set() })).toEqual({
      kind: "regular",
      workoutId: "new",
    });
    expect(pickToday({ ...base, completedIds: new Set(["new"]) })).toEqual({
      kind: "regular",
      workoutId: "old",
    });
  });

  it("ignores unpublished workouts and other levels", () => {
    const pick = pickToday({ ...base, completedIds: new Set(["new", "old"]) });
    expect(pick).toEqual({ kind: "rest" });
  });

  it("falls through to regular workouts when every starter is done but the flag lags", () => {
    expect(
      pickToday({ ...base, starterWeekDone: false, completedIds: new Set(["s1", "s2"]) }),
    ).toEqual({
      kind: "regular",
      workoutId: "new",
    });
  });
});

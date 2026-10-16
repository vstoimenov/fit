import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WORKOUT_ID = "5d10a436-118c-4a7f-9910-4d92197ac74b";

const mocks = vi.hoisted(() => ({
  markWorkoutComplete: vi.fn(),
  getCompletionStats: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/auth/require-user", () => ({
  requireUser: async () => ({ user: { id: "user-1" }, supabase: {} }),
}));
vi.mock("@/server/content/completion", () => ({
  markWorkoutComplete: mocks.markWorkoutComplete,
  getCompletionStats: mocks.getCompletionStats,
  setCompletionFeeling: vi.fn(),
}));

import { completeWorkout } from "./actions";

describe("completeWorkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markWorkoutComplete.mockResolvedValue({ status: "done", completionId: "c-1" });
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns the completion with its stats", async () => {
    const stats = { streakDays: 2, weekDone: 1, weekTarget: 3 };
    mocks.getCompletionStats.mockResolvedValue(stats);
    expect(await completeWorkout(WORKOUT_ID)).toEqual({
      ok: true,
      data: { completionId: "c-1", stats },
    });
  });

  it("still succeeds, with stats null, when the stats read fails", async () => {
    mocks.getCompletionStats.mockRejectedValue(new Error("db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await completeWorkout(WORKOUT_ID)).toEqual({
      ok: true,
      data: { completionId: "c-1", stats: null },
    });
    expect(log).toHaveBeenCalledOnce();
  });

  it("fails when the completion itself fails", async () => {
    mocks.markWorkoutComplete.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await completeWorkout(WORKOUT_ID)).toMatchObject({ ok: false });
    expect(mocks.getCompletionStats).not.toHaveBeenCalled();
  });
});

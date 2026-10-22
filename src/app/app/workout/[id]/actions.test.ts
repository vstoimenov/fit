import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WORKOUT_ID = "5d10a436-118c-4a7f-9910-4d92197ac74b";

const mocks = vi.hoisted(() => ({
  markWorkoutComplete: vi.fn(),
  getCompletionStats: vi.fn(),
  getMemberPoints: vi.fn(),
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

vi.mock("@/server/content/points", () => ({ getMemberPoints: mocks.getMemberPoints }));

import { completeWorkout } from "./actions";

describe("completeWorkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.markWorkoutComplete.mockResolvedValue({ status: "done", completionId: "c-1" });
    mocks.getCompletionStats.mockResolvedValue({ streakDays: 1, weekDone: 1, weekTarget: 3 });
    mocks.getMemberPoints
      .mockResolvedValueOnce({ points: 0, level: 1 })
      .mockResolvedValueOnce({ points: 10, level: 1 });
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns the completion with its stats and the points gained", async () => {
    const stats = { streakDays: 2, weekDone: 1, weekTarget: 3 };
    mocks.getCompletionStats.mockResolvedValue(stats);
    expect(await completeWorkout(WORKOUT_ID)).toEqual({
      ok: true,
      data: {
        completionId: "c-1",
        stats,
        points: { total: 10, level: 1, gained: 10, levelUp: false },
      },
    });
  });

  it("reads the points before and after the completion", async () => {
    await completeWorkout(WORKOUT_ID);
    expect(mocks.getMemberPoints).toHaveBeenCalledTimes(2);
    const [before, completion, after] = [
      mocks.getMemberPoints.mock.invocationCallOrder[0],
      mocks.markWorkoutComplete.mock.invocationCallOrder[0],
      mocks.getMemberPoints.mock.invocationCallOrder[1],
    ];
    expect(before).toBeLessThan(completion);
    expect(completion).toBeLessThan(after);
  });

  it("reports gained 0 when the day's points were already taken", async () => {
    mocks.getMemberPoints.mockReset();
    mocks.getMemberPoints
      .mockResolvedValueOnce({ points: 20, level: 1 })
      .mockResolvedValueOnce({ points: 20, level: 1 });
    expect(await completeWorkout(WORKOUT_ID)).toMatchObject({
      ok: true,
      data: { points: { total: 20, level: 1, gained: 0, levelUp: false } },
    });
  });

  it("flags a level-up", async () => {
    mocks.getMemberPoints.mockReset();
    mocks.getMemberPoints
      .mockResolvedValueOnce({ points: 215, level: 3 })
      .mockResolvedValueOnce({ points: 225, level: 4 });
    expect(await completeWorkout(WORKOUT_ID)).toMatchObject({
      ok: true,
      data: { points: { total: 225, level: 4, gained: 10, levelUp: true } },
    });
  });

  it("still succeeds, with points null, when the points read before fails", async () => {
    mocks.getMemberPoints.mockReset();
    mocks.getMemberPoints.mockRejectedValue(new Error("db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await completeWorkout(WORKOUT_ID);
    expect(result).toMatchObject({ ok: true, data: { completionId: "c-1", points: null } });
    expect(mocks.markWorkoutComplete).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalled();
  });

  it("still succeeds, with points null, when the points read after fails", async () => {
    mocks.getMemberPoints.mockReset();
    mocks.getMemberPoints
      .mockResolvedValueOnce({ points: 0, level: 1 })
      .mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await completeWorkout(WORKOUT_ID)).toMatchObject({
      ok: true,
      data: { completionId: "c-1", points: null },
    });
  });

  it("still succeeds, with stats null, when the stats read fails", async () => {
    mocks.getCompletionStats.mockRejectedValue(new Error("db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await completeWorkout(WORKOUT_ID)).toEqual({
      ok: true,
      data: {
        completionId: "c-1",
        stats: null,
        points: { total: 10, level: 1, gained: 10, levelUp: false },
      },
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

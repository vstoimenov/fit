import { describe, expect, it } from "vitest";
import { completionStats, regularSlotDates, seriesText } from "./completion-stats";

// 2026-10-14 is a Wednesday; the week is Mon 12 .. Sun 18.
const today = "2026-10-14";

describe("completionStats", () => {
  it("counts the streak, the done days and the scheduled slots of the current week", () => {
    expect(
      completionStats({
        slotDates: ["2026-10-07", "2026-10-12", "2026-10-14", "2026-10-16"],
        completionDates: ["2026-10-07", "2026-10-12", "2026-10-14"],
        today,
      }),
    ).toEqual({ streakDays: 3, weekDone: 2, weekTarget: 3 });
  });

  it("falls back to a target of 5 when the week has no scheduled slot", () => {
    expect(completionStats({ slotDates: [], completionDates: ["2026-10-14"], today })).toEqual({
      streakDays: 0,
      weekDone: 1,
      weekTarget: 5,
    });
  });

  it("never reports more done days than the target", () => {
    expect(
      completionStats({
        slotDates: ["2026-10-12"],
        completionDates: ["2026-10-12", "2026-10-13", "2026-10-14"],
        today,
      }),
    ).toMatchObject({ weekDone: 1, weekTarget: 1 });
  });
});

describe("regularSlotDates", () => {
  it("keeps published regular workouts of the level, as local dates", () => {
    const workouts = [
      { kind: "regular" as const, level: "beginner" as const, publishAt: "2026-10-12T21:30:00Z" },
      { kind: "regular" as const, level: "advanced" as const, publishAt: "2026-10-13T08:00:00Z" },
      { kind: "free" as const, level: "beginner" as const, publishAt: "2026-10-13T08:00:00Z" },
      { kind: "regular" as const, level: "beginner" as const, publishAt: null },
    ];
    // 21:30Z on the 12th is already the 13th in Sofia (UTC+3 in October).
    expect(regularSlotDates(workouts, "beginner", "Europe/Sofia")).toEqual(["2026-10-13"]);
  });
});

describe("seriesText", () => {
  it.each([
    [0, "0"],
    [1, "1 тренировка"],
    [2, "2 тренировки"],
    [5, "5 тренировки"],
    [21, "21 тренировки"],
    [22, "22 тренировки"],
  ])("%i -> %s", (n, text) => {
    expect(seriesText(n)).toBe(text);
  });
});

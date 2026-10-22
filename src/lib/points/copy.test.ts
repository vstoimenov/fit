import { describe, expect, it } from "vitest";
import { levelProgress, REWARDS } from "./levels";
import { afterWorkoutLines, levelChipText, nextStepText } from "./copy";

describe("levelChipText", () => {
  it("shows the level and the total", () => {
    expect(levelChipText(levelProgress(0))).toBe("Ниво 1 · 0 т.");
    expect(levelChipText(levelProgress(140))).toBe("Ниво 3 · 140 т.");
  });
});

describe("nextStepText", () => {
  it("names the points to the next level and its reward", () => {
    expect(nextStepText(levelProgress(0))).toBe(
      "Още 50 точки до ниво 2 · 20% отстъпка от следващия абонамент",
    );
  });

  it("uses the singular for one point", () => {
    expect(nextStepText(levelProgress(49))).toMatch(/^Още 1 точка до ниво 2/);
  });

  it("points at the next rewarded level, not the next level's own reward", () => {
    expect(nextStepText(levelProgress(220))).toBe(`Още 130 точки до ниво 5 · ${REWARDS[6]}`);
  });

  it("drops the reward when none is left", () => {
    expect(nextStepText({ ...levelProgress(1300), nextReward: null })).toBe(
      "Още 300 точки до ниво 10",
    );
  });

  it("says maximum level at the top", () => {
    expect(nextStepText(levelProgress(1600))).toBe("Максимално ниво");
  });
});

describe("afterWorkoutLines", () => {
  it("shows nothing without a points result", () => {
    expect(afterWorkoutLines(null)).toEqual([]);
  });

  it("shows the gain and the total", () => {
    expect(afterWorkoutLines({ total: 10, level: 1, gained: 10, levelUp: false })).toEqual([
      "+10 точки · общо 10",
    ]);
  });

  it("says today's points are already taken when nothing was gained", () => {
    expect(afterWorkoutLines({ total: 20, level: 1, gained: 0, levelUp: false })).toEqual([
      "Днешните точки вече са взети · общо 20",
    ]);
  });

  it("adds the reward line on a rewarded level-up", () => {
    expect(afterWorkoutLines({ total: 225, level: 4, gained: 10, levelUp: true })).toEqual([
      "+10 точки · общо 225",
      `Ниво 4! ${REWARDS[4]}`,
    ]);
  });

  it("adds an encouraging line on a level-up without a reward", () => {
    expect(afterWorkoutLines({ total: 55, level: 2, gained: 10, levelUp: true })).toEqual([
      "+10 точки · общо 55",
      "Ниво 2! Продължавай така.",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { LEVEL_THRESHOLDS, REWARDS, levelForPoints, levelProgress } from "./levels";

describe("levelForPoints", () => {
  it.each([
    [-20, 1],
    [0, 1],
    [49, 1],
    [50, 2],
    [119, 2],
    [120, 3],
    [219, 3],
    [220, 4],
    [1599, 9],
    [1600, 10],
    [5000, 10],
  ])("%i points -> level %i", (points, level) => {
    expect(levelForPoints(points)).toBe(level);
  });

  it("has the ten agreed thresholds", () => {
    expect(LEVEL_THRESHOLDS).toEqual([0, 50, 120, 220, 350, 520, 730, 980, 1270, 1600]);
  });
});

describe("levelProgress", () => {
  it("reports the band, remaining points and next reward", () => {
    expect(levelProgress(140)).toEqual({
      level: 3,
      points: 140,
      nextLevel: 4,
      toNext: 80,
      percent: Math.round(((140 - 120) / (220 - 120)) * 100),
      nextReward: "20% отстъпка от следващия абонамент",
    });
  });

  it("starts at 0 percent on a threshold", () => {
    expect(levelProgress(120)).toMatchObject({ level: 3, toNext: 100, percent: 0 });
  });

  it("points at the next rewarded level when the next level has none", () => {
    expect(levelProgress(220)).toMatchObject({ level: 4, nextLevel: 5, nextReward: REWARDS[6] });
    expect(levelProgress(520)).toMatchObject({ level: 6, nextLevel: 7, nextReward: REWARDS[8] });
    expect(levelProgress(980)).toMatchObject({ level: 8, nextLevel: 9, nextReward: REWARDS[10] });
  });

  it("treats negative totals like zero for the band", () => {
    expect(levelProgress(-30)).toMatchObject({
      level: 1,
      points: -30,
      nextLevel: 2,
      toNext: 50,
      percent: 0,
    });
  });

  it("has no next step at level 10", () => {
    expect(levelProgress(1700)).toEqual({
      level: 10,
      points: 1700,
      nextLevel: null,
      toNext: null,
      percent: 100,
      nextReward: null,
    });
  });

  it("exposes the reward copy", () => {
    expect(REWARDS).toEqual({
      4: "20% отстъпка от следващия абонамент",
      6: "Ексклузивни тренировки",
      8: "Лична консултация с Аксения",
      10: "6 месеца клуб безплатно",
    });
  });
});

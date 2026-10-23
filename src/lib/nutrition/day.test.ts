import { describe, expect, it } from "vitest";
import { dayResult, rescale, showDayResult, sumEntries } from "./day";
import type { EstimateItem } from "./schema";

describe("sumEntries", () => {
  it("returns zeros for an empty day", () => {
    expect(sumEntries([])).toEqual({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("adds kcal and rounds macros to 0.1 g", () => {
    expect(
      sumEntries([
        { kcal: 120, proteinG: 10.04, carbsG: 5.01, fatG: 2.5 },
        { kcal: 80, proteinG: 0.02, carbsG: 9.95, fatG: 1.2 },
      ]),
    ).toEqual({ kcal: 200, proteinG: 10.1, carbsG: 15, fatG: 3.7 });
  });
});

describe("dayResult", () => {
  it("is in when exactly on target", () => {
    expect(dayResult(1650, 1650)).toBe("in");
  });

  it("is under when more than 10 % below target", () => {
    expect(dayResult(1484, 1650)).toBe("under");
  });

  it("is in at exactly 10 % below target", () => {
    expect(dayResult(1485, 1650)).toBe("in");
  });

  it("is over when more than 10 % above target", () => {
    expect(dayResult(1816, 1650)).toBe("over");
  });

  it("is in at exactly 10 % above target", () => {
    expect(dayResult(1815, 1650)).toBe("in");
  });
});

describe("showDayResult", () => {
  it("shows the result for a past day at any hour", () => {
    expect(showDayResult("2026-10-22", "2026-10-23", 9)).toBe(true);
  });

  it("hides today's result before 20:00 Sofia", () => {
    expect(showDayResult("2026-10-23", "2026-10-23", 19)).toBe(false);
  });

  it("shows today's result from 20:00 Sofia", () => {
    expect(showDayResult("2026-10-23", "2026-10-23", 20)).toBe(true);
  });

  it("never shows a future day", () => {
    expect(showDayResult("2026-10-24", "2026-10-23", 23)).toBe(false);
  });
});

describe("rescale", () => {
  const item: EstimateItem = {
    name: "Пилешко филе",
    grams: 100,
    kcal: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
  };

  it("scales kcal linearly to the new grams, rounding kcal to an integer", () => {
    expect(rescale(item, 150).kcal).toBe(248);
  });

  it("scales macros linearly, rounded to 0.1 g", () => {
    const scaled = rescale(item, 150);
    expect(scaled.grams).toBe(150);
    expect(scaled.proteinG).toBe(46.5);
    expect(scaled.fatG).toBe(5.4);
  });
});

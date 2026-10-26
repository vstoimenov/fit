import { describe, expect, it } from "vitest";
import { timePlan } from "./time-plan";

describe("timePlan", () => {
  it("computes the weekly minutes, 30-day workouts, length and level", () => {
    expect(timePlan(20, 4)).toEqual({
      minutes: 20,
      days: 4,
      weeklyMinutes: 80,
      workoutsPer30Days: 17,
      length: "mid",
      lengthLabel: "средни",
      levelLabel: "Начинаеща → Напреднала след седмица 2",
    });
  });

  it("maps minutes to the library's length buckets at the boundaries", () => {
    expect(timePlan(15, 4).length).toBe("short");
    expect(timePlan(16, 4).length).toBe("mid");
    expect(timePlan(25, 4).length).toBe("mid");
    expect(timePlan(26, 4).length).toBe("long");
  });

  it("maps days to a starting level", () => {
    expect(timePlan(20, 3).levelLabel).toBe("Начинаеща");
    expect(timePlan(20, 5).levelLabel).toBe("Начинаеща → Напреднала след седмица 2");
    expect(timePlan(20, 6).levelLabel).toBe("Напреднала");
  });

  it("clamps out-of-range input and rounds minutes to the nearest 5", () => {
    const low = timePlan(7, 9);
    expect(low.minutes).toBe(10);
    expect(low.days).toBe(6);
    expect(low.weeklyMinutes).toBe(60);
    expect(low.levelLabel).toBe("Напреднала");
    expect(timePlan(23, 3).minutes).toBe(25);
    expect(timePlan(99, 0).minutes).toBe(40);
    expect(timePlan(99, 0).days).toBe(2);
    expect(timePlan(Number.NaN, Number.NaN)).toMatchObject({ minutes: 20, days: 4 });
  });
});

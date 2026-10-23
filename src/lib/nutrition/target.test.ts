import { describe, expect, it } from "vitest";
import { calorieTarget, type TargetInput } from "./target";

const base: TargetInput = {
  weightKg: 70,
  heightCm: 165,
  birthYear: 1994,
  activity: "light",
  goal: "tone",
  today: "2026-10-23",
};

describe("calorieTarget", () => {
  it("uses Mifflin-St Jeor for a woman scaled by activity and rounded to 10 kcal", () => {
    expect(calorieTarget(base)?.kcal).toBe(1940);
  });

  it("applies a 15 % deficit for lose_weight", () => {
    expect(calorieTarget({ ...base, goal: "lose_weight" })?.kcal).toBe(1650);
  });

  it("never goes below 1200 kcal", () => {
    const target = calorieTarget({
      weightKg: 45,
      heightCm: 150,
      birthYear: 1990,
      activity: "sedentary",
      goal: "lose_weight",
      today: "2026-10-23",
    });
    expect(target?.kcal).toBe(1200);
  });

  it("keeps maintenance kcal for under-18s even when the goal is lose_weight", () => {
    const under18 = { ...base, birthYear: 2010 };
    expect(calorieTarget({ ...under18, goal: "lose_weight" })?.kcal).toBe(
      calorieTarget({ ...under18, goal: "tone" })?.kcal,
    );
    expect(calorieTarget({ ...under18, goal: "lose_weight" })?.kcal).toBe(2050);
  });

  it("keeps maintenance at ages 17 and 18 and applies the deficit from 19", () => {
    const at = (birthYear: number, goal: TargetInput["goal"]) =>
      calorieTarget({ ...base, birthYear, goal })?.kcal;
    expect(at(2009, "lose_weight")).toBe(at(2009, "tone"));
    expect(at(2008, "lose_weight")).toBe(at(2008, "tone"));
    expect(at(2007, "lose_weight")).toBe(1720);
    expect(at(2007, "tone")).toBe(2030);
  });

  it("keeps maintenance when BMI is below 18.5 even for lose_weight", () => {
    const thin = { ...base, weightKg: 45, heightCm: 165, activity: "light" as const };
    expect(calorieTarget({ ...thin, goal: "lose_weight" })?.kcal).toBe(
      calorieTarget({ ...thin, goal: "tone" })?.kcal,
    );
  });

  it("applies the deficit from BMI 18.5 upwards", () => {
    const at = (weightKg: number, goal: TargetInput["goal"]) =>
      calorieTarget({ ...base, weightKg, heightCm: 165, goal })?.kcal;
    expect(at(60, "lose_weight")).toBeLessThan(at(60, "tone")!);
    // 50.4 kg at 165 cm is BMI 18.51, 50.3 kg is 18.47.
    expect(at(50.4, "lose_weight")).toBeLessThan(at(50.4, "tone")!);
    expect(at(50.3, "lose_weight")).toBe(at(50.3, "tone"));
  });

  it("treats a missing goal as maintenance", () => {
    expect(calorieTarget({ ...base, goal: null })?.kcal).toBe(1940);
  });

  it("returns null when weight, height, birth year or activity is missing", () => {
    expect(calorieTarget({ ...base, weightKg: null })).toBeNull();
    expect(calorieTarget({ ...base, heightCm: null })).toBeNull();
    expect(calorieTarget({ ...base, birthYear: null })).toBeNull();
    expect(calorieTarget({ ...base, activity: null })).toBeNull();
  });

  it("sets protein at 1.6 g per kg of body weight", () => {
    expect(calorieTarget(base)?.proteinG).toBe(112);
  });

  it("caps protein at 30 % of kcal", () => {
    const target = calorieTarget({ ...base, weightKg: 150, birthYear: 1990, goal: "tone" });
    expect(target?.kcal).toBe(3010);
    expect(target?.proteinG).toBe(226);
  });

  it("sets fat at 30 % of kcal", () => {
    expect(calorieTarget(base)?.fatG).toBe(65);
  });

  it("fills the rest of kcal with carbs", () => {
    expect(calorieTarget(base)?.carbsG).toBe(227);
  });

  it("never returns negative macros", () => {
    const inputs: TargetInput[] = [
      base,
      { ...base, weightKg: 45, heightCm: 150, birthYear: 1990, activity: "sedentary" },
      { ...base, weightKg: 150, birthYear: 1990 },
      { ...base, weightKg: 200, heightCm: 210, birthYear: 1960, activity: "active" },
    ];
    for (const input of inputs) {
      const target = calorieTarget(input);
      expect(target).not.toBeNull();
      expect(target!.proteinG).toBeGreaterThanOrEqual(0);
      expect(target!.carbsG).toBeGreaterThanOrEqual(0);
      expect(target!.fatG).toBeGreaterThanOrEqual(0);
    }
  });
});

import { describe, expect, it } from "vitest";
import { shareText, toShareCard } from "./share-card";

const base = { workoutTitle: "Цяло тяло", streakDays: 4, weekDone: 3, weekTarget: 5 };

describe("toShareCard", () => {
  it("keeps only the four public keys, never health or questionnaire data", () => {
    const card = toShareCard({
      ...base,
      weight_kg: 64,
      waist_cm: 70,
      goal: "отслабване",
      problems: ["кръст"],
      height_cm: 168,
      email: "a@example.test",
      timezone: "Europe/Sofia",
    });
    expect(Object.keys(card).sort()).toEqual(
      ["streakDays", "weekDone", "weekTarget", "workoutTitle"].sort(),
    );
    expect(JSON.stringify(card)).not.toMatch(/64|70|отслабване|кръст|168|example|Sofia/);
  });

  it("trims a long title to 60 characters with an ellipsis", () => {
    const card = toShareCard({ ...base, workoutTitle: "А".repeat(80) });
    expect(card.workoutTitle.length).toBeLessThanOrEqual(60);
    expect(card.workoutTitle.endsWith("…")).toBe(true);
  });

  it("keeps a short title as it is, trimmed of spaces", () => {
    expect(toShareCard({ ...base, workoutTitle: "  Цяло тяло " }).workoutTitle).toBe("Цяло тяло");
  });

  it("floors and clamps the numbers", () => {
    expect(toShareCard({ ...base, weekTarget: 0 }).weekTarget).toBe(1);
    expect(toShareCard({ ...base, weekTarget: 12 }).weekTarget).toBe(7);
    expect(toShareCard({ ...base, weekDone: 9, weekTarget: 5 }).weekDone).toBe(5);
    expect(toShareCard({ ...base, weekDone: -2 }).weekDone).toBe(0);
    expect(toShareCard({ ...base, streakDays: -3 }).streakDays).toBe(0);
    expect(toShareCard({ ...base, streakDays: 4.7 }).streakDays).toBe(4);
  });

  it("falls back to safe values for missing or non-numeric input", () => {
    expect(toShareCard({})).toEqual({
      workoutTitle: "",
      streakDays: 0,
      weekDone: 0,
      weekTarget: 1,
    });
    expect(toShareCard({ ...base, streakDays: "5", workoutTitle: 7 })).toMatchObject({
      streakDays: 0,
      workoutTitle: "",
    });
  });
});

describe("shareText", () => {
  it("names the workout, the streak and the week", () => {
    expect(shareText(toShareCard(base))).toBe("Цяло тяло · 4 дни поред · 3/5 тази седмица");
  });

  it("uses the singular for a one-day streak", () => {
    expect(shareText(toShareCard({ ...base, streakDays: 1 }))).toBe(
      "Цяло тяло · 1 ден поред · 3/5 тази седмица",
    );
  });

  it("leaves the streak out when it is zero", () => {
    expect(shareText(toShareCard({ ...base, streakDays: 0 }))).toBe("Цяло тяло · 3/5 тази седмица");
  });
});

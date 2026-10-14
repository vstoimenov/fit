import { describe, expect, it } from "vitest";
import { buildPlanSummary } from "./plan-summary";

describe("buildPlanSummary", () => {
  it("turns answers into a concrete plan", () => {
    expect(
      buildPlanSummary({
        goal: "tone",
        problems: ["belly", "back_posture"],
        time: "20-30",
        level: "beginner",
      }),
    ).toEqual({
      headline: "4 седмици да стегнеш тялото",
      perWeek: 3,
      minutes: "20–30 минути",
      focus: ["Коремът", "Гръб и стойка"],
    });
  });

  it("falls back to full body when no problem was picked", () => {
    const summary = buildPlanSummary({ goal: null, problems: [], time: null, level: "pro" });
    expect(summary).toEqual({
      headline: "4 седмици към по-силната ти версия",
      perWeek: 4,
      minutes: "20–30 минути",
      focus: ["Цяло тяло"],
    });
  });

  it("drops unknown stored problems instead of crashing", () => {
    expect(
      buildPlanSummary({ goal: "energy", problems: ["knees"], time: "15", level: "advanced" })
        .focus,
    ).toEqual(["Цяло тяло"]);
  });
});

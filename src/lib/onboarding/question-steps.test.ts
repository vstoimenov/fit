import { describe, expect, it } from "vitest";
import { QUESTION_COUNT, QUESTION_STEPS, stepCounter } from "./question-steps";

describe("question steps", () => {
  it("counts the questionnaire screens", () => {
    expect(QUESTION_COUNT).toBe(QUESTION_STEPS.length);
    expect(new Set(QUESTION_STEPS).size).toBe(QUESTION_COUNT);
  });
});

describe("nutrition step", () => {
  it("is the sixth question: after the time screen, before the contact screen", () => {
    expect(QUESTION_STEPS.indexOf("nutrition")).toBe(5);
    expect(QUESTION_STEPS[4]).toBe("time");
    expect(QUESTION_STEPS[6]).toBe("contact");
    expect(QUESTION_COUNT).toBe(7);
  });
});

describe("stepCounter", () => {
  it("counts the questions only, so the sign-up screen before them does not shift the numbers", () => {
    expect(stepCounter("goal")).toBe(`1/${QUESTION_COUNT}`);
    expect(stepCounter("contact")).toBe(`${QUESTION_COUNT}/${QUESTION_COUNT}`);
  });

  it("names the sign-up and phone screens „Профил“ instead of counting them as questions", () => {
    expect(stepCounter("account")).toBe("Профил");
    expect(stepCounter("phone")).toBe("Профил");
  });
});

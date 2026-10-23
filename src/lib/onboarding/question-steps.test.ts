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
  it("shows n/N over the questions only", () => {
    expect(stepCounter("goal", 0)).toBe(`1/${QUESTION_COUNT}`);
    expect(stepCounter("contact", QUESTION_COUNT - 1)).toBe(`${QUESTION_COUNT}/${QUESTION_COUNT}`);
  });

  it("names the account step „Профил“ instead of counting it as a question", () => {
    expect(stepCounter("account", QUESTION_COUNT)).toBe("Профил");
  });
});

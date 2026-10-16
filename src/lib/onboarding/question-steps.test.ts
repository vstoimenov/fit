import { describe, expect, it } from "vitest";
import { QUESTION_COUNT, QUESTION_STEPS } from "./question-steps";

describe("question steps", () => {
  it("counts the questionnaire screens", () => {
    expect(QUESTION_COUNT).toBe(QUESTION_STEPS.length);
    expect(new Set(QUESTION_STEPS).size).toBe(QUESTION_COUNT);
  });
});

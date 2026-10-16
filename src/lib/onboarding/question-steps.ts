/** The questionnaire screens, in order. The sign-up screen comes after these and is not a question. */
export const QUESTION_STEPS = [
  "goal",
  "problems",
  "experience",
  "body",
  "time",
  "contact",
] as const;

export type QuestionStepId = (typeof QUESTION_STEPS)[number];

/** How many questions the landing page promises. Derived, so it cannot drift from the wizard. */
export const QUESTION_COUNT = QUESTION_STEPS.length;

/** The wizard's step counter: „2/6“ over the questions, „Профил“ on the sign-up screen. */
export function stepCounter(step: QuestionStepId | "account", index: number): string {
  return step === "account" ? "Профил" : `${index + 1}/${QUESTION_COUNT}`;
}

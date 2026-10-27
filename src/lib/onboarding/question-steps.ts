/** The questionnaire screens, in order. The sign-up (or phone) screen comes before these and is not a question. */
export const QUESTION_STEPS = [
  "goal",
  "problems",
  "experience",
  "body",
  "time",
  "nutrition",
  "contact",
] as const;

export type QuestionStepId = (typeof QUESTION_STEPS)[number];

/** How many questions the landing page promises. Derived, so it cannot drift from the wizard. */
export const QUESTION_COUNT = QUESTION_STEPS.length;

/** The wizard's step counter: „2/7“ over the questions, „Профил“ on the sign-up and phone screens. */
export function stepCounter(step: QuestionStepId | "account" | "phone"): string {
  const position = (QUESTION_STEPS as readonly string[]).indexOf(step);
  return position === -1 ? "Профил" : `${position + 1}/${QUESTION_COUNT}`;
}

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

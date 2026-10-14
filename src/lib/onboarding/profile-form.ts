/** Reads the profile "answers" form into the shape profileAnswersSchema validates. */
export function profileFormToAnswers(form: FormData): Record<string, unknown> {
  const text = (name: string) => String(form.get(name) ?? "");
  return {
    goal: text("goal"),
    problems: form.getAll("problems").map(String),
    // A blank field becomes 0, which the schema rejects with the range message.
    heightCm: Number(text("heightCm")),
    weightKg: Number(text("weightKg")),
    targetWeightKg: Number(text("targetWeightKg")),
    phone: text("phone"),
    phoneCallConsent: form.get("phoneCallConsent") === "on",
    marketingConsent: form.get("marketingConsent") === "on",
  };
}

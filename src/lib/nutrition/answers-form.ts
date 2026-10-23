/** Reads the nutrition answers form into the shape nutritionAnswersSchema validates. */
export function nutritionFormToAnswers(form: FormData): Record<string, unknown> {
  const text = (name: string) => String(form.get(name) ?? "");
  return {
    // A blank field becomes 0, which the schema rejects with the range message.
    birthYear: Number(text("birthYear")),
    activity: text("activity"),
    diet: text("diet"),
    allergens: form.getAll("allergens").map(String),
    avoidFoods: text("avoidFoods"),
    mealsPerDay: Number(text("mealsPerDay")),
  };
}

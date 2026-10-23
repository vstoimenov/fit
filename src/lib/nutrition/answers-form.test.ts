import { describe, expect, it } from "vitest";
import { nutritionFormToAnswers } from "./answers-form";
import { nutritionAnswersSchema } from "./schema";

function form(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

const schema = nutritionAnswersSchema(2026);

describe("nutritionFormToAnswers", () => {
  it("turns form fields into schema input: numbers and repeated allergens", () => {
    const raw = nutritionFormToAnswers(
      form([
        ["birthYear", "1990"],
        ["activity", "moderate"],
        ["diet", "vegetarian"],
        ["allergens", "milk"],
        ["allergens", "eggs"],
        ["avoidFoods", "  чушки "],
        ["mealsPerDay", "5"],
      ]),
    );
    expect(schema.parse(raw)).toEqual({
      birthYear: 1990,
      activity: "moderate",
      diet: "vegetarian",
      allergens: ["milk", "eggs"],
      avoidFoods: "чушки",
      mealsPerDay: 5,
    });
  });

  it("leaves a blank year and unanswered choices for the schema to reject", () => {
    const raw = nutritionFormToAnswers(form([["mealsPerDay", "3"]]));
    expect(schema.safeParse(raw).success).toBe(false);
    expect(
      schema.safeParse({ ...raw, birthYear: 1990, activity: "light", diet: "vegan" }).success,
    ).toBe(true);
  });

  it("does not let an unknown allergen through", () => {
    const raw = nutritionFormToAnswers(
      form([
        ["birthYear", "1990"],
        ["activity", "light"],
        ["diet", "vegan"],
        ["allergens", "pollen"],
        ["mealsPerDay", "3"],
      ]),
    );
    expect(schema.safeParse(raw).success).toBe(false);
  });
});

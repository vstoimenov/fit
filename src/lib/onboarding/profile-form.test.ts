import { describe, expect, it } from "vitest";
import { profileAnswersSchema } from "./schema";
import { profileFormToAnswers } from "./profile-form";

function form(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("profileFormToAnswers", () => {
  it("turns form fields into schema input: numbers, repeated problems, checkboxes", () => {
    const raw = profileFormToAnswers(
      form([
        ["goal", "tone"],
        ["problems", "belly"],
        ["problems", "arms"],
        ["heightCm", "168"],
        ["weightKg", "66.5"],
        ["targetWeightKg", "61"],
        ["phone", "0888 123 456"],
        ["phoneCallConsent", "on"],
      ]),
    );
    expect(profileAnswersSchema.parse(raw)).toEqual({
      goal: "tone",
      problems: ["belly", "arms"],
      heightCm: 168,
      weightKg: 66.5,
      targetWeightKg: 61,
      phone: "0888123456",
      phoneCallConsent: true,
      marketingConsent: false,
    });
  });

  it("treats unchecked boxes as withdrawn and no problems as an empty list", () => {
    const raw = profileFormToAnswers(
      form([
        ["goal", "energy"],
        ["heightCm", "170"],
        ["weightKg", "60"],
        ["targetWeightKg", "58"],
        ["phone", ""],
      ]),
    );
    expect(profileAnswersSchema.parse(raw)).toMatchObject({
      problems: [],
      phoneCallConsent: false,
      marketingConsent: false,
      phone: "",
    });
  });

  it("maps a blank number to a value the range message handles", () => {
    const raw = profileFormToAnswers(
      form([
        ["goal", "tone"],
        ["heightCm", ""],
      ]),
    );
    const result = profileAnswersSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });
});

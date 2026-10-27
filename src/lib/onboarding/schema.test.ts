import { describe, expect, it } from "vitest";
import { sofiaToday } from "@/lib/progress-photos/today";
import {
  levelFromExperience,
  nutritionStepSchema,
  onboardingSchema,
  profileAnswersSchema,
  contactStepSchema,
} from "./schema";

const currentYear = Number(sofiaToday().slice(0, 4));

const valid = {
  name: "Мария",
  goal: "tone",
  problems: ["belly", "back_posture"],
  experience: "never",
  heightCm: 168,
  weightKg: 66.5,
  targetWeightKg: 61,
  time: "20-30",
  phone: "",
  phoneCallConsent: false,
  healthConsent: true,
  marketingConsent: false,
  birthYear: 1990,
  activity: "light",
  diet: "omnivore",
  allergens: ["milk", "nuts"],
  avoidFoods: "черен дроб",
  mealsPerDay: 4,
};

describe("contactStepSchema", () => {
  it("requires a phone on the sign-up screen and normalizes it", () => {
    expect(contactStepSchema.safeParse({ phone: "", phoneCallConsent: false }).success).toBe(false);
    expect(contactStepSchema.parse({ phone: "0888 123-456", phoneCallConsent: true })).toEqual({
      phone: "0888123456",
      phoneCallConsent: true,
    });
  });

  it("rejects a phone that is not a number, with the message on the phone field", () => {
    const result = contactStepSchema.safeParse({ phone: "abc", phoneCallConsent: false });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["phone"]);
  });
});

describe("onboardingSchema", () => {
  it("accepts a complete answer set", () => {
    expect(onboardingSchema.parse(valid).name).toBe("Мария");
  });

  it("requires explicit health-data consent", () => {
    const result = onboardingSchema.safeParse({ ...valid, healthConsent: false });
    expect(result.success).toBe(false);
  });

  it("requires a phone number when she agrees to be called", () => {
    expect(onboardingSchema.safeParse({ ...valid, phoneCallConsent: true }).success).toBe(false);
    expect(
      onboardingSchema.safeParse({ ...valid, phoneCallConsent: true, phone: "+359 888 123 456" })
        .success,
    ).toBe(true);
  });

  it("normalizes phone numbers typed with dashes, brackets and spaces", () => {
    const phone = (value: string) => onboardingSchema.parse({ ...valid, phone: value }).phone;
    expect(phone("0888-123-456")).toBe("0888123456");
    expect(phone("(088) 8123456")).toBe("0888123456");
    expect(phone("+359 888 123 456")).toBe("+359888123456");
    expect(phone("   ")).toBe("");
  });

  it("rejects phone numbers that are not numbers", () => {
    expect(onboardingSchema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, phone: "12345" }).success).toBe(false);
  });

  it("treats a blank phone as missing when she agrees to be called", () => {
    expect(
      onboardingSchema.safeParse({ ...valid, phoneCallConsent: true, phone: "   " }).success,
    ).toBe(false);
  });

  it("rejects impossible body values", () => {
    expect(onboardingSchema.safeParse({ ...valid, heightCm: 90 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, weightKg: 400 }).success).toBe(false);
  });

  it("rejects unknown problems", () => {
    expect(onboardingSchema.safeParse({ ...valid, problems: ["knees"] }).success).toBe(false);
  });

  it("accepts an optional browser timezone and rejects an overlong one", () => {
    expect(onboardingSchema.parse(valid).timezone).toBeUndefined();
    expect(onboardingSchema.parse({ ...valid, timezone: "America/New_York" }).timezone).toBe(
      "America/New_York",
    );
    expect(onboardingSchema.safeParse({ ...valid, timezone: "x".repeat(65) }).success).toBe(false);
  });
});

describe("onboardingSchema nutrition answers", () => {
  const parse = (patch: Record<string, unknown>) =>
    onboardingSchema.safeParse({ ...valid, ...patch });

  it("keeps the nutrition answers", () => {
    expect(onboardingSchema.parse(valid)).toMatchObject({
      birthYear: 1990,
      activity: "light",
      diet: "omnivore",
      allergens: ["milk", "nuts"],
      avoidFoods: "черен дроб",
      mealsPerDay: 4,
    });
  });

  it("requires them", () => {
    for (const field of [
      "birthYear",
      "activity",
      "diet",
      "allergens",
      "avoidFoods",
      "mealsPerDay",
    ]) {
      const rest: Record<string, unknown> = { ...valid };
      delete rest[field];
      expect(onboardingSchema.safeParse(rest).success, field).toBe(false);
    }
  });

  it("rejects an unknown allergen, activity, diet or meal count", () => {
    expect(parse({ allergens: ["milk", "pollen"] }).success).toBe(false);
    expect(parse({ activity: "extreme" }).success).toBe(false);
    expect(parse({ diet: "carnivore" }).success).toBe(false);
    expect(parse({ mealsPerDay: 2 }).success).toBe(false);
    expect(parse({ mealsPerDay: 6 }).success).toBe(false);
  });

  it("accepts no allergens and an empty avoid list", () => {
    expect(parse({ allergens: [], avoidFoods: "" }).success).toBe(true);
  });

  it("limits birth year to 1940 and sixteen years before this year", () => {
    expect(parse({ birthYear: 1939 }).success).toBe(false);
    expect(parse({ birthYear: 1940 }).success).toBe(true);
    expect(parse({ birthYear: currentYear - 16 }).success).toBe(true);
    expect(parse({ birthYear: currentYear - 15 }).success).toBe(false);
    expect(parse({ birthYear: 1990.5 }).success).toBe(false);
  });

  it("limits what she avoids to 200 characters", () => {
    expect(parse({ avoidFoods: "а".repeat(200) }).success).toBe(true);
    expect(parse({ avoidFoods: "а".repeat(201) }).success).toBe(false);
  });
});

describe("nutritionStepSchema", () => {
  it("validates only the nutrition screen, with the error on the field", () => {
    expect(
      nutritionStepSchema.safeParse({
        birthYear: 1990,
        activity: "light",
        diet: "vegan",
        allergens: [],
        avoidFoods: "",
        mealsPerDay: 3,
      }).success,
    ).toBe(true);
    const bad = nutritionStepSchema.safeParse({
      birthYear: 2030,
      activity: "light",
      diet: "vegan",
      allergens: [],
      avoidFoods: "",
      mealsPerDay: 3,
    });
    expect(bad.success).toBe(false);
    expect(!bad.success && bad.error.issues[0]?.path).toEqual(["birthYear"]);
  });
});

describe("profileAnswersSchema", () => {
  const editable = {
    goal: "tone",
    problems: ["belly"],
    heightCm: 168,
    weightKg: 66.5,
    targetWeightKg: 61,
    phone: "0888-123-456",
    phoneCallConsent: true,
    marketingConsent: false,
  };

  it("shares the onboarding rules: ranges, phone normalization, call consent needs a phone", () => {
    expect(profileAnswersSchema.parse(editable).phone).toBe("0888123456");
    expect(profileAnswersSchema.safeParse({ ...editable, heightCm: 90 }).success).toBe(false);
    expect(profileAnswersSchema.safeParse({ ...editable, weightKg: 29 }).success).toBe(false);
    expect(profileAnswersSchema.safeParse({ ...editable, targetWeightKg: 251 }).success).toBe(
      false,
    );
    expect(profileAnswersSchema.safeParse({ ...editable, phone: "" }).success).toBe(false);
    expect(
      profileAnswersSchema.safeParse({ ...editable, phone: "", phoneCallConsent: false }).success,
    ).toBe(true);
  });

  it("does not carry onboarding-only or privileged fields", () => {
    const parsed = profileAnswersSchema.parse({ ...editable, role: "admin", level: "pro" });
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "goal",
        "heightCm",
        "marketingConsent",
        "phone",
        "phoneCallConsent",
        "problems",
        "targetWeightKg",
        "weightKg",
      ].sort(),
    );
  });
});

describe("levelFromExperience", () => {
  it("maps experience to a starting level", () => {
    expect(levelFromExperience("never")).toBe("beginner");
    expect(levelFromExperience("sometimes")).toBe("advanced");
    expect(levelFromExperience("regular")).toBe("pro");
  });
});

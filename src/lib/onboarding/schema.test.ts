import { describe, expect, it } from "vitest";
import { levelFromExperience, onboardingSchema } from "./schema";

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
};

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

  it("rejects impossible body values", () => {
    expect(onboardingSchema.safeParse({ ...valid, heightCm: 90 }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...valid, weightKg: 400 }).success).toBe(false);
  });

  it("rejects unknown problems", () => {
    expect(onboardingSchema.safeParse({ ...valid, problems: ["knees"] }).success).toBe(false);
  });
});

describe("levelFromExperience", () => {
  it("maps experience to a starting level", () => {
    expect(levelFromExperience("never")).toBe("beginner");
    expect(levelFromExperience("sometimes")).toBe("advanced");
    expect(levelFromExperience("regular")).toBe("pro");
  });
});

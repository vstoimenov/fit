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
});

describe("levelFromExperience", () => {
  it("maps experience to a starting level", () => {
    expect(levelFromExperience("never")).toBe("beginner");
    expect(levelFromExperience("sometimes")).toBe("advanced");
    expect(levelFromExperience("regular")).toBe("pro");
  });
});

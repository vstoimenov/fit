import { describe, expect, it } from "vitest";
import { onboardingRedirect } from "./redirect";

describe("onboardingRedirect", () => {
  it("sends an in-person client to her trainings, not the online questions", () => {
    expect(onboardingRedirect({ onboarding_done: false, studio_client: true })).toBe("/na-myasto");
  });
  it("sends anyone else who has not finished to the questions", () => {
    expect(onboardingRedirect({ onboarding_done: false, studio_client: false })).toBe("/start");
  });
  it("lets an onboarded member through", () => {
    expect(onboardingRedirect({ onboarding_done: true, studio_client: true })).toBeNull();
    expect(onboardingRedirect({ onboarding_done: true, studio_client: false })).toBeNull();
  });
});

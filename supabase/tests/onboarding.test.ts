import { beforeAll, describe, expect, it } from "vitest";
import { saveOnboarding } from "@/server/onboarding/save-onboarding";
import {
  adminClient,
  createUser,
  freeWorkoutId,
  signedInClient,
  type TypedClient,
} from "./helpers";

const answers = {
  name: "Мария",
  goal: "lose_weight",
  problems: ["belly", "postpartum"],
  experience: "sometimes",
  heightCm: 165,
  weightKg: 72,
  targetWeightKg: 64,
  time: "15",
  phone: "+359888123456",
  phoneCallConsent: true,
  healthConsent: true,
  marketingConsent: true,
};

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("saveOnboarding", () => {
  it("stores answers, starting level and consent, and returns the free workout", async () => {
    const user = await createUser(admin, "onb");
    const result = await saveOnboarding(await signedInClient(user), user.id, answers);
    expect(result.freeWorkoutId).toBe(await freeWorkoutId(admin));

    const { data } = await admin.from("profiles").select("*").eq("id", user.id).single();
    expect(data).toMatchObject({
      name: "Мария",
      goal: "lose_weight",
      problems: ["belly", "postpartum"],
      level: "advanced",
      height_cm: 165,
      weight_kg: 72,
      target_weight_kg: 64,
      time_per_session: "15",
      phone: "+359888123456",
      phone_call_consent: true,
      marketing_consent: true,
      onboarding_done: true,
    });
    expect(data?.health_data_consent_at).not.toBeNull();
  });

  it("rejects answers without health consent and leaves the profile untouched", async () => {
    const user = await createUser(admin, "onb-no");
    await expect(
      saveOnboarding(await signedInClient(user), user.id, { ...answers, healthConsent: false }),
    ).rejects.toThrow();
    const { data } = await admin
      .from("profiles")
      .select("onboarding_done")
      .eq("id", user.id)
      .single();
    expect(data?.onboarding_done).toBe(false);
  });

  it("stores an empty phone as null", async () => {
    const user = await createUser(admin, "onb-phone");
    await saveOnboarding(await signedInClient(user), user.id, {
      ...answers,
      phone: "",
      phoneCallConsent: false,
    });
    const { data } = await admin.from("profiles").select("phone").eq("id", user.id).single();
    expect(data?.phone).toBeNull();
  });
});

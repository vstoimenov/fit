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

  it("stores the normalized phone", async () => {
    const user = await createUser(admin, "onb-norm");
    await saveOnboarding(await signedInClient(user), user.id, {
      ...answers,
      phone: "0888-123-456",
    });
    const { data } = await admin.from("profiles").select("phone").eq("id", user.id).single();
    expect(data?.phone).toBe("0888123456");
  });

  it("is idempotent: a replay returns the free workout and keeps the first answers and consent time", async () => {
    const user = await createUser(admin, "onb-replay");
    const client = await signedInClient(user);
    await saveOnboarding(client, user.id, answers);
    const first = await admin.from("profiles").select("*").eq("id", user.id).single();

    const again = await saveOnboarding(client, user.id, {
      ...answers,
      name: "Друга",
      goal: "tone",
      experience: "regular",
      marketingConsent: false,
    });
    expect(again.freeWorkoutId).toBe(await freeWorkoutId(admin));

    const second = await admin.from("profiles").select("*").eq("id", user.id).single();
    expect(second.data).toEqual(first.data);
    expect(second.data?.health_data_consent_at).toBe(first.data?.health_data_consent_at);
  });

  it("stores the browser timezone sent with the answers", async () => {
    const user = await createUser(admin, "onb-tz");
    await saveOnboarding(await signedInClient(user), user.id, {
      ...answers,
      timezone: "America/New_York",
    });
    const { data } = await admin
      .from("profiles")
      .select("timezone, onboarding_done")
      .eq("id", user.id)
      .single();
    expect(data).toEqual({ timezone: "America/New_York", onboarding_done: true });
  });

  it("keeps Europe/Sofia and still finishes onboarding when the timezone is unknown", async () => {
    const user = await createUser(admin, "onb-badtz");
    await saveOnboarding(await signedInClient(user), user.id, { ...answers, timezone: "Bad/Zone" });
    const { data } = await admin
      .from("profiles")
      .select("timezone, onboarding_done, name")
      .eq("id", user.id)
      .single();
    expect(data).toEqual({ timezone: "Europe/Sofia", onboarding_done: true, name: "Мария" });
  });

  it("ignores extra keys: level comes from experience and the role stays client", async () => {
    const user = await createUser(admin, "onb-hostile");
    await saveOnboarding(await signedInClient(user), user.id, {
      ...answers,
      experience: "never",
      role: "admin",
      level: "pro",
    });
    const { data } = await admin.from("profiles").select("role, level").eq("id", user.id).single();
    expect(data).toMatchObject({ role: "client", level: "beginner" });
  });
});

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  addCheckIn,
  deleteAccount,
  exportMyData,
  updateProfileAnswers,
  updateProfileBasics,
} from "@/server/profile/profile";
import { addNote } from "@/server/admin/notes";
import {
  adminClient,
  createAdminUser,
  createUser,
  freeWorkoutId,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("profile services", () => {
  it("updates name and level", async () => {
    const user = await createUser(admin, "basics");
    await updateProfileBasics(await signedInClient(user), user.id, { name: "Ива", level: "pro" });
    const { data } = await admin.from("profiles").select("name, level").eq("id", user.id).single();
    expect(data).toEqual({ name: "Ива", level: "pro" });
  });

  describe("updateProfileAnswers", () => {
    const edits = {
      goal: "strength",
      problems: ["arms", "back_posture"],
      heightCm: 170,
      weightKg: 63.5,
      targetWeightKg: 60,
      phone: "0888-123-456",
      phoneCallConsent: true,
      marketingConsent: true,
    };

    it("persists the corrected answers and consents, normalizing the phone", async () => {
      const user = await createUser(admin, "answers");
      const db = await signedInClient(user);
      await updateProfileAnswers(db, user.id, edits);
      const { data } = await admin.from("profiles").select("*").eq("id", user.id).single();
      expect(data).toMatchObject({
        goal: "strength",
        problems: ["arms", "back_posture"],
        height_cm: 170,
        weight_kg: 63.5,
        target_weight_kg: 60,
        phone: "0888123456",
        phone_call_consent: true,
        marketing_consent: true,
      });
    });

    it("lets her withdraw the call and marketing consent, and clear the phone", async () => {
      const user = await createUser(admin, "withdraw");
      const db = await signedInClient(user);
      await updateProfileAnswers(db, user.id, edits);
      await updateProfileAnswers(db, user.id, {
        ...edits,
        phone: "",
        phoneCallConsent: false,
        marketingConsent: false,
      });
      const { data } = await admin
        .from("profiles")
        .select("phone, phone_call_consent, marketing_consent")
        .eq("id", user.id)
        .single();
      expect(data).toEqual({ phone: null, phone_call_consent: false, marketing_consent: false });
    });

    it("rejects enabling call consent without a phone and changes nothing", async () => {
      const user = await createUser(admin, "nophone");
      const db = await signedInClient(user);
      await expect(
        updateProfileAnswers(db, user.id, { ...edits, phone: "", heightCm: 175 }),
      ).rejects.toThrow();
      const { data } = await admin
        .from("profiles")
        .select("phone_call_consent, height_cm")
        .eq("id", user.id)
        .single();
      expect(data).toEqual({ phone_call_consent: false, height_cm: null });
    });

    it("rejects values outside the onboarding ranges", async () => {
      const user = await createUser(admin, "range");
      await expect(
        updateProfileAnswers(await signedInClient(user), user.id, { ...edits, heightCm: 90 }),
      ).rejects.toThrow();
    });

    it("never writes role, level, starter progress or the health consent time", async () => {
      const user = await createUser(admin, "hostile");
      const db = await signedInClient(user);
      const before = await admin.from("profiles").select("*").eq("id", user.id).single();
      await updateProfileAnswers(db, user.id, {
        ...edits,
        role: "admin",
        level: "pro",
        starter_week_done_at: new Date().toISOString(),
        health_data_consent_at: new Date().toISOString(),
        onboarding_done: true,
      });
      const { data } = await admin.from("profiles").select("*").eq("id", user.id).single();
      expect(data).toMatchObject({
        role: "client",
        level: before.data?.level,
        starter_week_done_at: null,
        health_data_consent_at: null,
        onboarding_done: false,
      });
    });
  });

  it("exports the user's own data", async () => {
    const user = await createUser(admin, "export");
    const db = await signedInClient(user);
    await addCheckIn(db, { weight_kg: 63 });
    await db.from("workout_completions").insert({ workout_id: await freeWorkoutId(admin) });
    const anonId = randomUUID();
    const { error: seedError } = await admin.from("visits").insert([
      { anon_id: anonId, user_id: user.id, path: "/app", device: "mobile" },
      { anon_id: randomUUID(), path: "/other", device: "desktop" },
    ]);
    expect(seedError).toBeNull();
    const data = await exportMyData(db, user.id, admin);
    expect(data.profile).toMatchObject({ id: user.id });
    expect(data.check_ins).toHaveLength(1);
    expect(data.workout_completions).toHaveLength(1);
    expect(data.visits).toEqual([
      expect.objectContaining({ path: "/app", device: "mobile", referrer: null, utm: null }),
    ]);
  });

  it("exports the notes written about her (kind, text, time) but nobody else's and no author ids", async () => {
    const { db: boss } = await createAdminUser(admin, "export-boss");
    const user = await createUser(admin, "export-notes");
    const other = await createUser(admin, "export-notes-other");
    await addNote(boss, user.id, { kind: "note", body: "Болки в коляното." });
    await addNote(boss, user.id, { kind: "call", body: "Обадих се, не вдигна." });
    await addNote(boss, other.id, { kind: "note", body: "Чужда бележка." });
    const data = await exportMyData(await signedInClient(user), user.id, admin);
    const notes = data.client_notes as Record<string, unknown>[];
    expect(notes).toHaveLength(2);
    expect(notes.map((n) => n.body).sort()).toEqual(["Болки в коляното.", "Обадих се, не вдигна."]);
    expect(notes.map((n) => n.kind).sort()).toEqual(["call", "note"]);
    for (const n of notes) {
      expect(Object.keys(n).sort()).toEqual(["body", "created_at", "kind"]);
    }
  });

  it("deletes the account and every row that belongs to it", async () => {
    const user = await createUser(admin, "delete");
    await addCheckIn(await signedInClient(user), { energy: 3 });
    const anonId = randomUUID();
    const strangerAnonId = randomUUID();
    const { error: seedError } = await admin.from("visits").insert([
      { anon_id: anonId, user_id: user.id, path: "/app", device: "mobile" },
      { anon_id: anonId, path: "/before-login", device: "mobile" },
      { anon_id: strangerAnonId, path: "/unrelated", device: "desktop" },
    ]);
    expect(seedError).toBeNull();
    const { db: boss } = await createAdminUser(admin, "delete-boss");
    await addNote(boss, user.id, { kind: "note", body: "Ще бъде изтрита." });
    await deleteAccount(admin, user.id);
    const { data: notes } = await admin.from("client_notes").select("id").eq("user_id", user.id);
    expect(notes).toEqual([]);
    const { data: profile } = await admin.from("profiles").select("id").eq("id", user.id);
    const { data: checkIns } = await admin.from("check_ins").select("id").eq("user_id", user.id);
    expect(profile).toEqual([]);
    expect(checkIns).toEqual([]);
    const { data: visits } = await admin
      .from("visits")
      .select("anon_id")
      .in("anon_id", [anonId, strangerAnonId]);
    expect(visits).toEqual([{ anon_id: strangerAnonId }]);
  });
});

import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  addCheckIn,
  deleteAccount,
  exportMyData,
  updateProfileAnswers,
  updateProfileBasics,
} from "@/server/profile/profile";
import { sofiaToday } from "@/lib/progress-photos/today";
import { addNote } from "@/server/admin/notes";
import { recordProgressPhoto } from "@/server/progress/photos";
import {
  adminClient,
  createAdminUser,
  createUser,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;

// Smallest plausible JPEG: SOI, JFIF APP0, EOI.
const JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

async function addPhoto(db: TypedClient, userId: string, takenOn: string): Promise<string> {
  const path = `${userId}/${randomUUID()}.jpg`;
  const up = await db.storage
    .from("progress-photos")
    .upload(path, JPEG, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  await recordProgressPhoto(db, { path, takenOn });
  return path;
}

const photoNames = async (userId: string) => {
  const { data, error } = await admin.storage.from("progress-photos").list(userId);
  if (error) throw error;
  return data.map((o) => o.name);
};

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
    expect(data.profile).toMatchObject({ id: user.id, diet: null, allergens: [] });
    expect(data.food_entries).toEqual([]);
    expect(data.menu_swaps).toEqual([]);
    expect(data.check_ins).toHaveLength(1);
    expect(data.workout_completions).toHaveLength(1);
    expect(data.visits).toEqual([
      expect.objectContaining({ path: "/app", device: "mobile", referrer: null, utm: null }),
    ]);
  });

  it("exports her progress photos with a working, time-limited link", async () => {
    const user = await createUser(admin, "export-photos");
    const other = await createUser(admin, "export-photos-other");
    const db = await signedInClient(user);
    await addPhoto(db, user.id, "2026-09-15");
    await addPhoto(await signedInClient(other), other.id, "2026-10-01");
    const data = await exportMyData(db, user.id, admin);
    const photos = data.progress_photos as Record<string, unknown>[];
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ taken_on: "2026-09-15", url_expires_in_seconds: 3600 });
    expect(Object.keys(photos[0]).sort()).toEqual([
      "created_at",
      "taken_on",
      "url",
      "url_expires_in_seconds",
    ]);
    expect((await fetch(photos[0].url as string)).status).toBe(200);
  });

  it("exports her points ledger and the rewards handed out to her, and nobody else's", async () => {
    const { db: boss } = await createAdminUser(admin, "export-pts-boss");
    const user = await createUser(admin, "export-pts");
    const other = await createUser(admin, "export-pts-other");
    await boss.rpc("admin_adjust_points", { p_user_id: user.id, p_points: 40, p_reason: "Бонус" });
    await boss.rpc("admin_adjust_points", { p_user_id: other.id, p_points: 7, p_reason: "Чужда" });
    await boss.from("rewards_given").insert([
      { user_id: user.id, level: 4, note: "Пратено" },
      { user_id: other.id, level: 4 },
    ]);
    const data = await exportMyData(await signedInClient(user), user.id, admin);
    const ledger = data.points_ledger as Record<string, unknown>[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ source: "admin", points: 40, reason: "Бонус" });
    expect(Object.keys(ledger[0]).sort()).toEqual([
      "created_at",
      "points",
      "reason",
      "ref",
      "source",
    ]);
    const rewards = data.rewards_given as Record<string, unknown>[];
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ level: 4, note: "Пратено" });
    expect(Object.keys(rewards[0]).sort()).toEqual(["given_at", "level", "note"]);
  });

  it("exports her menu swaps (day, slot, meal) but nobody else's", async () => {
    const user = await createUser(admin, "export-swaps");
    const other = await createUser(admin, "export-swaps-other");
    await grantAccess(admin, user.id);
    await grantAccess(admin, other.id);
    const title = `Експорт ястие ${randomUUID().slice(0, 8)}`;
    const meal = await admin
      .from("meals")
      .insert({
        title,
        meal_types: ["lunch"],
        ingredients: [{ name: "Ориз", grams: 100 }],
        kcal: 400,
        protein_g: 10,
        carbs_g: 60,
        fat_g: 5,
        published: true,
      })
      .select("id")
      .single();
    expect(meal.error).toBeNull();
    const mealId = meal.data!.id;
    try {
      const today = sofiaToday();
      const db = await signedInClient(user);
      const mine = await db
        .from("menu_swaps")
        .insert({ user_id: user.id, menu_date: today, slot: 1, meal_id: mealId });
      expect(mine.error).toBeNull();
      const theirs = await (
        await signedInClient(other)
      )
        .from("menu_swaps")
        .insert({ user_id: other.id, menu_date: today, slot: 0, meal_id: mealId });
      expect(theirs.error).toBeNull();

      const data = await exportMyData(db, user.id, admin);
      const swaps = data.menu_swaps as Record<string, unknown>[];
      expect(swaps).toHaveLength(1);
      expect(swaps[0]).toMatchObject({
        menu_date: today,
        slot: 1,
        meal_id: mealId,
        meal_title: title,
      });
      expect(Object.keys(swaps[0]).sort()).toEqual([
        "created_at",
        "meal_id",
        "meal_title",
        "menu_date",
        "slot",
      ]);
    } finally {
      await admin.from("meals").delete().eq("id", mealId);
    }
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
    await deleteAccount(admin, user.id, async () => {});
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

  describe("deleting an account with progress photos", () => {
    it("removes her stored photos along with the account", async () => {
      const user = await createUser(admin, "del-photos");
      const bystander = await createUser(admin, "del-photos-other");
      const db = await signedInClient(user);
      await addPhoto(db, user.id, "2026-09-01");
      await addPhoto(db, user.id, "2026-10-01");
      await addPhoto(await signedInClient(bystander), bystander.id, "2026-10-01");
      expect(await photoNames(user.id)).toHaveLength(2);
      await deleteAccount(admin, user.id, async () => {});
      expect(await photoNames(user.id)).toEqual([]);
      expect(await photoNames(bystander.id)).toHaveLength(1);
      const { data } = await admin.from("progress_photos").select("id").eq("user_id", user.id);
      expect(data).toEqual([]);
    });

    it("aborts and keeps the account when removing the photos fails", async () => {
      const user = await createUser(admin, "del-photos-fail");
      await addPhoto(await signedInClient(user), user.id, "2026-10-01");
      const failing = new Proxy(admin, {
        get(target, prop) {
          if (prop === "storage") {
            return {
              from: (bucket: string) =>
                new Proxy(target.storage.from(bucket), {
                  get(bucketApi, method) {
                    if (method === "remove") {
                      return async () => ({ data: null, error: new Error("storage down") });
                    }
                    const v = Reflect.get(bucketApi, method, bucketApi);
                    return typeof v === "function" ? v.bind(bucketApi) : v;
                  },
                }),
            };
          }
          const v = Reflect.get(target, prop, target);
          return typeof v === "function" ? v.bind(target) : v;
        },
      });
      await expect(deleteAccount(failing, user.id, async () => {})).rejects.toThrow();
      const { data } = await admin.auth.admin.getUserById(user.id);
      expect(data.user?.id).toBe(user.id);
      expect(await photoNames(user.id)).toHaveLength(1);
      // Nothing was deleted, so remove the test user ourselves.
      await deleteAccount(admin, user.id, async () => {});
      expect(await photoNames(user.id)).toEqual([]);
    });
  });

  describe("deleting an account with a paid subscription", () => {
    const profileRows = async (id: string) =>
      (await admin.from("profiles").select("id").eq("id", id)).data;

    it("cancels a live paid subscription before deleting the account", async () => {
      const user = await createUser(admin, "del-paid");
      await admin.from("subscriptions").insert({
        user_id: user.id,
        provider: "stripe",
        status: "active",
        provider_sub_id: "sub_del",
      });
      const cancel = vi.fn(async () => {});
      await deleteAccount(admin, user.id, cancel);
      expect(cancel).toHaveBeenCalledWith({ provider: "stripe", subscriptionId: "sub_del" });
      expect(await profileRows(user.id)).toEqual([]);
    });

    it("keeps the account when cancelling the paid subscription fails", async () => {
      const user = await createUser(admin, "del-fail");
      await admin.from("subscriptions").insert({
        user_id: user.id,
        provider: "stripe",
        status: "active",
        provider_sub_id: "sub_fail",
      });
      await expect(
        deleteAccount(admin, user.id, async () => {
          throw new Error("stripe down");
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await profileRows(user.id)).toHaveLength(1);
      // Nothing was deleted, so remove the test user ourselves.
      await deleteAccount(admin, user.id, async () => {});
      expect(await profileRows(user.id)).toEqual([]);
    });

    it("does not call the provider for manual subscriptions", async () => {
      const user = await createUser(admin, "del-manual");
      await grantAccess(admin, user.id);
      const cancel = vi.fn(async () => {});
      await deleteAccount(admin, user.id, cancel);
      expect(cancel).not.toHaveBeenCalled();
      expect(await profileRows(user.id)).toEqual([]);
    });

    it("cancels a past_due subscription even after the grace period has ended", async () => {
      const user = await createUser(admin, "del-pastdue");
      await admin.from("subscriptions").insert({
        user_id: user.id,
        provider: "stripe",
        status: "past_due",
        provider_sub_id: "sub_pastdue",
        grace_until: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
      const cancel = vi.fn(async () => {});
      await deleteAccount(admin, user.id, cancel);
      expect(cancel).toHaveBeenCalledWith({ provider: "stripe", subscriptionId: "sub_pastdue" });
      expect(await profileRows(user.id)).toEqual([]);
    });

    it("does not call the provider for an ended paid subscription", async () => {
      const user = await createUser(admin, "del-ended");
      await admin.from("subscriptions").insert({
        user_id: user.id,
        provider: "stripe",
        status: "canceled",
        provider_sub_id: "sub_ended",
        current_period_end: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
      const cancel = vi.fn(async () => {});
      await deleteAccount(admin, user.id, cancel);
      expect(cancel).not.toHaveBeenCalled();
      expect(await profileRows(user.id)).toEqual([]);
    });
  });
});

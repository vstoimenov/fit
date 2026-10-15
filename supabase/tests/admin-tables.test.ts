import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createAal1Admin,
  createAdminUser,
  createUser,
  createWorkout,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let bossId: string;

beforeAll(async () => {
  admin = adminClient();
  const created = await createAdminUser(admin, "tbl-admin");
  boss = created.db;
  bossId = created.user.id;
});

const workout = (title: string) => ({
  title,
  kind: "regular" as const,
  level: "beginner" as const,
  duration_min: 20,
  publish_at: null,
});

describe("admin writes on workouts", () => {
  it("lets an aal2 admin create, edit and schedule a workout with media", async () => {
    const { data, error } = await boss
      .from("workouts")
      .insert(workout("Админ тренировка"))
      .select("id")
      .single();
    expect(error).toBeNull();
    const media = await boss.from("workout_media").insert({
      workout_id: data!.id,
      provider: "youtube",
      video_url: "https://youtu.be/ml6cT4AZdqI",
    });
    expect(media.error).toBeNull();
    const when = new Date(Date.now() + 86_400_000).toISOString();
    const upd = await boss
      .from("workouts")
      .update({ publish_at: when })
      .eq("id", data!.id)
      .select("id");
    expect(upd.error).toBeNull();
    expect(upd.data).toHaveLength(1);
  });

  it("refuses the same writes to an aal1 admin and to a client", async () => {
    const { db: half } = await createAal1Admin(admin, "tbl-half");
    const client = await signedInClient(await createUser(admin, "tbl-client"));
    for (const db of [half, client]) {
      const { error } = await db.from("workouts").insert(workout("Не трябва"));
      expect(error?.code).toBe("42501");
    }
  });

  it("deletes an unused workout but refuses one somebody completed", async () => {
    const unused = await createWorkout(admin, workout("Неизползвана"));
    const del = await boss.from("workouts").delete().eq("id", unused).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);

    const freeId = await freeWorkoutId(admin);
    const member = await signedInClient(await createUser(admin, "tbl-done"));
    expect(
      (await member.from("workout_completions").insert({ workout_id: freeId })).error,
    ).toBeNull();
    const refused = await boss.from("workouts").delete().eq("id", freeId).select("id");
    expect(refused.error).toBeNull();
    expect(refused.data).toEqual([]);
    const { data: still } = await admin.from("workouts").select("id").eq("id", freeId);
    expect(still).toHaveLength(1);
    // Even a service-role delete is stopped by the foreign key.
    const hard = await admin.from("workouts").delete().eq("id", freeId);
    expect(hard.error?.code).toBe("23503");
  });

  it("reorders the starter week in one call", async () => {
    const { data: starters } = await admin
      .from("workouts")
      .select("id")
      .eq("kind", "starter")
      .order("starter_order");
    const ids = (starters ?? []).map((s) => s.id);
    const reversed = [...ids].reverse();
    const { error } = await boss.rpc("admin_reorder_starters", { p_ids: reversed });
    expect(error).toBeNull();
    const { data: after } = await admin
      .from("workouts")
      .select("id")
      .eq("kind", "starter")
      .order("starter_order");
    expect(after?.map((s) => s.id)).toEqual(reversed);
    await boss.rpc("admin_reorder_starters", { p_ids: ids });
  });

  it("rejects a reorder that misses or repeats a starter", async () => {
    const { data: starters } = await admin.from("workouts").select("id").eq("kind", "starter");
    const ids = (starters ?? []).map((s) => s.id);
    const dup = await boss.rpc("admin_reorder_starters", { p_ids: [ids[0]!, ...ids.slice(0, -1)] });
    expect(dup.error?.code).toBe("22023");
    const half = await createAal1Admin(admin, "tbl-reorder");
    const denied = await half.db.rpc("admin_reorder_starters", { p_ids: ids });
    expect(denied.error?.code).toBe("42501");
  });
});

describe("subscriptions: manual grants only", () => {
  it("lets an admin create a manual grant", async () => {
    const user = await createUser(admin, "tbl-grant");
    const { error } = await boss
      .from("subscriptions")
      .insert({ user_id: user.id, provider: "manual", status: "active" });
    expect(error).toBeNull();
    const { data } = await admin
      .from("subscriptions")
      .select("provider, status")
      .eq("user_id", user.id);
    expect(data).toEqual([{ provider: "manual", status: "active" }]);
  });

  it("refuses to touch a paid subscription", async () => {
    const user = await createUser(admin, "tbl-paid");
    await admin
      .from("subscriptions")
      .insert({ user_id: user.id, provider: "stripe", status: "active" });
    const upd = await boss
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", user.id)
      .select("user_id");
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([]);
    const { data: still } = await admin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id);
    expect(still).toEqual([{ status: "active" }]);
    const ins = await boss.from("subscriptions").insert({
      user_id: (await createUser(admin, "tbl-paid2")).id,
      provider: "stripe",
      status: "active",
    });
    expect(ins.error?.code).toBe("42501");
  });
});

describe("client notes", () => {
  it("records the author automatically and hides notes from clients", async () => {
    const user = await createUser(admin, "tbl-note");
    const { data, error } = await boss
      .from("client_notes")
      .insert({ user_id: user.id, kind: "note", body: "Звъннах, всичко е наред." })
      .select("author_id")
      .single();
    expect(error).toBeNull();
    expect(data?.author_id).toBe(bossId);
    const clientDb = await signedInClient(user);
    const { data: seen } = await clientDb.from("client_notes").select("id");
    expect(seen).toEqual([]);
  });

  it("requires snooze_until exactly for snooze notes", async () => {
    const user = await createUser(admin, "tbl-snooze");
    const bad = await boss.from("client_notes").insert({ user_id: user.id, kind: "snooze" });
    expect(bad.error?.code).toBe("23514");
    const ok = await boss.from("client_notes").insert({
      user_id: user.id,
      kind: "snooze",
      snooze_until: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });
    expect(ok.error).toBeNull();
  });
});

describe("audit log", () => {
  it("records who changed what on a workout", async () => {
    const id = await createWorkout(admin, workout("Одит"));
    await boss.from("workouts").update({ title: "Одит 2" }).eq("id", id);
    const { data, error } = await boss
      .from("audit_log")
      .select("actor_id, action, target_type, target_id, diff")
      .eq("target_id", id)
      .eq("action", "update");
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({ actor_id: bossId, target_type: "workouts" });
    expect(data?.[0]?.diff).toMatchObject({ title: { from: "Одит", to: "Одит 2" } });
  });

  it("records manual grants and role changes, and hides the log from non-admins", async () => {
    const user = await createUser(admin, "tbl-audit");
    await grantAccess(admin, user.id);
    await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
    const { data } = await admin
      .from("audit_log")
      .select("target_type, action")
      .eq("target_id", user.id);
    expect(data).toEqual(
      expect.arrayContaining([
        { target_type: "subscriptions", action: "insert" },
        { target_type: "profiles", action: "update" },
      ]),
    );
    const clientDb = await signedInClient(await createUser(admin, "tbl-audit-client"));
    const { data: hidden } = await clientDb.from("audit_log").select("id");
    expect(hidden).toEqual([]);
    const write = await clientDb.from("audit_log").insert({ action: "x", target_type: "y" });
    expect(write.error?.code).toBe("42501");
  });

  it("does not log an update that changed nothing but updated_at", async () => {
    const id = await createWorkout(admin, workout("Без промяна"));
    await boss.from("workouts").update({ title: "Без промяна" }).eq("id", id);
    const { data } = await admin
      .from("audit_log")
      .select("id")
      .eq("target_id", id)
      .eq("action", "update");
    expect(data).toEqual([]);
  });
});

describe("settings", () => {
  it("lets an admin upsert and read a setting, hidden from clients", async () => {
    const value = { inactiveDays: 6, minCompletionPct: 40 };
    const { error } = await boss.from("settings").upsert({ key: "risk", value });
    expect(error).toBeNull();
    const { data } = await boss.from("settings").select("value").eq("key", "risk").single();
    expect(data?.value).toEqual(value);
    const clientDb = await signedInClient(await createUser(admin, "tbl-set-client"));
    const { data: hidden } = await clientDb.from("settings").select("key");
    expect(hidden).toEqual([]);
    await boss.from("settings").delete().eq("key", "risk");
  });
});

describe("thumbnails bucket", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const exists = async (path: string) => {
    const { data, error } = await admin.storage.from("thumbnails").list("", { search: path });
    expect(error).toBeNull();
    return (data ?? []).some((o) => o.name === path);
  };

  it("lets an admin upload, replace and remove; anyone reads by public URL", async () => {
    const path = `test-${crypto.randomUUID()}.png`;
    try {
      const up = await boss.storage
        .from("thumbnails")
        .upload(path, png, { contentType: "image/png" });
      expect(up.error).toBeNull();
      const { data } = boss.storage.from("thumbnails").getPublicUrl(path);
      const res = await fetch(data.publicUrl);
      expect(res.status).toBe(200);

      const replaced = await boss.storage
        .from("thumbnails")
        .upload(path, png, { contentType: "image/png", upsert: true });
      expect(replaced.error).toBeNull();

      const removed = await boss.storage.from("thumbnails").remove([path]);
      expect(removed.error).toBeNull();
      expect(removed.data).toHaveLength(1);
      expect(await exists(path)).toBe(false);
    } finally {
      await admin.storage.from("thumbnails").remove([path]);
    }
  });

  it("refuses uploads and removals from clients, aal1 admins and anonymous visitors", async () => {
    const path = `test-${crypto.randomUUID()}.png`;
    try {
      const up = await boss.storage
        .from("thumbnails")
        .upload(path, png, { contentType: "image/png" });
      expect(up.error).toBeNull();
      const client = await signedInClient(await createUser(admin, "tbl-thumb"));
      const { db: half } = await createAal1Admin(admin, "tbl-thumb-half");
      for (const db of [client, half, anonClient()]) {
        const denied = await db.storage
          .from("thumbnails")
          .upload(`x-${crypto.randomUUID()}.png`, png, { contentType: "image/png" });
        expect(denied.error).not.toBeNull();
        const overwrite = await db.storage
          .from("thumbnails")
          .upload(path, png, { contentType: "image/png", upsert: true });
        expect(overwrite.error).not.toBeNull();
        const removed = await db.storage.from("thumbnails").remove([path]);
        expect(removed.data ?? []).toEqual([]);
      }
      expect(await exists(path)).toBe(true);
    } finally {
      await admin.storage.from("thumbnails").remove([path]);
    }
  });
});

describe("everyone but an aal2 admin is locked out of the admin tables", () => {
  let target: string;
  let plainWorkout: string;
  let planId: string;

  beforeAll(async () => {
    target = await createWorkout(admin, workout("Защитена"));
    plainWorkout = (await admin.from("workouts").insert(workout("Без медия")).select("id").single())
      .data!.id;
    planId = (await admin.from("plans").select("id").limit(1).single()).data!.id;
    await admin.from("settings").upsert({ key: "rls_probe", value: { a: 1 } });
    await admin.from("client_notes").insert({
      user_id: bossId,
      kind: "note",
      body: "само за админи",
    });
  });

  afterAll(async () => {
    await admin.from("settings").delete().eq("key", "rls_probe");
  });

  const actors = async () => {
    const client = await signedInClient(await createUser(admin, "lock-client"));
    const half = await createAal1Admin(admin, "lock-half");
    return [
      { label: "client", db: client, id: (await client.auth.getUser()).data.user!.id },
      { label: "aal1 admin", db: half.db, id: half.user.id },
    ];
  };

  it("refuses inserts into media, plans, subscriptions, notes and settings", async () => {
    for (const { label, db, id } of await actors()) {
      const results = {
        media: await db.from("workout_media").insert({
          workout_id: plainWorkout,
          provider: "youtube",
          video_url: "https://youtu.be/x",
        }),
        plan: await db
          .from("plans")
          .insert({ name: "Безплатно", interval: "month", price_cents: 1 }),
        selfGrant: await db
          .from("subscriptions")
          .insert({ user_id: id, provider: "manual", status: "active" }),
        paid: await db
          .from("subscriptions")
          .insert({ user_id: id, provider: "stripe", status: "active" }),
        note: await db.from("client_notes").insert({ user_id: id, kind: "note", body: "x" }),
        setting: await db.from("settings").insert({ key: "rls_other", value: {} }),
      };
      for (const [name, r] of Object.entries(results)) {
        expect(r.error?.code, `${label}: ${name}`).toBe("42501");
      }
      const { data: subs } = await admin.from("subscriptions").select("user_id").eq("user_id", id);
      expect(subs, `${label} must not hold a subscription`).toEqual([]);
    }
    const { data: media } = await admin
      .from("workout_media")
      .select("workout_id")
      .eq("workout_id", plainWorkout);
    expect(media).toEqual([]);
    const { data: other } = await admin.from("settings").select("key").eq("key", "rls_other");
    expect(other).toEqual([]);
  });

  it("changes nothing on update or delete of media, plans and settings", async () => {
    for (const { label, db } of await actors()) {
      const delMedia = await db
        .from("workout_media")
        .delete()
        .eq("workout_id", target)
        .select("workout_id");
      expect(delMedia.error, label).toBeNull();
      expect(delMedia.data, label).toEqual([]);
      const updPlan = await db
        .from("plans")
        .update({ price_cents: 1 })
        .eq("id", planId)
        .select("id");
      expect(updPlan.error, label).toBeNull();
      expect(updPlan.data, label).toEqual([]);
      const delSetting = await db.from("settings").delete().eq("key", "rls_probe").select("key");
      expect(delSetting.error, label).toBeNull();
      expect(delSetting.data, label).toEqual([]);
      const updSetting = await db
        .from("settings")
        .update({ value: { a: 2 } })
        .eq("key", "rls_probe")
        .select("key");
      expect(updSetting.data, label).toEqual([]);
    }
    const { data: media } = await admin
      .from("workout_media")
      .select("workout_id")
      .eq("workout_id", target);
    expect(media).toHaveLength(1);
    const { data: plan } = await admin
      .from("plans")
      .select("price_cents")
      .eq("id", planId)
      .single();
    expect(plan?.price_cents).not.toBe(1);
    const { data: setting } = await admin
      .from("settings")
      .select("value")
      .eq("key", "rls_probe")
      .single();
    expect(setting?.value).toEqual({ a: 1 });
  });

  it("shows nothing from audit_log, client_notes or settings", async () => {
    for (const table of ["audit_log", "client_notes", "settings"] as const) {
      const { data: real } = await admin.from(table).select("*").limit(1);
      expect(real?.length, `${table} must hold a row so the check is not vacuous`).toBe(1);
      for (const { label, db } of await actors()) {
        const { data, error } = await db.from(table).select("*");
        expect(error, `${label}: ${table}`).toBeNull();
        expect(data, `${label}: ${table}`).toEqual([]);
      }
    }
  });
});

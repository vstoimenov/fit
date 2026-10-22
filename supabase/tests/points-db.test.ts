import { beforeAll, describe, expect, it } from "vitest";
import { markWorkoutComplete } from "@/server/content/completion";
import {
  adminClient,
  anonClient,
  createAdminUser,
  createUser,
  createWorkout,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TestUser,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let freeId: string;

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "points-admin")).db;
  freeId = await freeWorkoutId(admin);
});

async function ledger(userId: string) {
  const { data, error } = await admin
    .from("points_ledger")
    .select("source, ref, points, created_by")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return data;
}

async function member(label: string): Promise<{ user: TestUser; db: TypedClient }> {
  const user = await createUser(admin, label);
  return { user, db: await signedInClient(user) };
}

async function addCheckIn(userId: string, createdAt: string): Promise<void> {
  const { error } = await admin
    .from("check_ins")
    .insert({ user_id: userId, created_at: createdAt, energy: 3 });
  if (error) throw error;
}

async function publishedWorkout(title: string): Promise<string> {
  return createWorkout(admin, {
    title,
    kind: "regular",
    level: "beginner",
    duration_min: 15,
    publish_at: new Date(Date.now() - 60_000).toISOString(),
  });
}

async function addCompletion(userId: string, workoutId: string, completedAt: string) {
  const { error } = await admin
    .from("workout_completions")
    .insert({ user_id: userId, workout_id: workoutId, completed_at: completedAt });
  if (error) throw error;
}

function sofiaDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(d);
}

describe("workout points", () => {
  it("awards 10 points for a completed workout, keyed by the Sofia day", async () => {
    const { user, db } = await member("pts-workout");
    const done = await markWorkoutComplete(db, user.id, freeId);
    expect(done.status).toBe("done");
    await markWorkoutComplete(db, user.id, freeId);

    const rows = await ledger(user.id);
    expect(rows).toEqual([
      { source: "workout", ref: sofiaDate(new Date()), points: 10, created_by: null },
    ]);

    // A second award for the same day is a no-op.
    const again = await admin
      .from("points_ledger")
      .upsert(
        { user_id: user.id, source: "workout", ref: rows[0]!.ref, points: 10 },
        { onConflict: "user_id,source,ref", ignoreDuplicates: true },
      );
    expect(again.error).toBeNull();
    expect(await ledger(user.id)).toHaveLength(1);
  });

  it("awards at most once per Sofia day across different workouts", async () => {
    const { user } = await member("pts-workout-day");
    const w1 = await publishedWorkout("Точки 1");
    const w2 = await publishedWorkout("Точки 2");
    await addCompletion(user.id, w1, "2026-10-20T07:00:00Z");
    await addCompletion(user.id, w2, "2026-10-20T18:00:00Z");
    expect(await ledger(user.id)).toEqual([
      { source: "workout", ref: "2026-10-20", points: 10, created_by: null },
    ]);
  });

  it("splits days at Sofia midnight (23:30 vs 00:30)", async () => {
    const { user } = await member("pts-workout-midnight");
    const w1 = await publishedWorkout("Точки 3");
    const w2 = await publishedWorkout("Точки 4");
    await addCompletion(user.id, w1, "2026-10-25T21:30:00Z");
    await addCompletion(user.id, w2, "2026-10-25T22:30:00Z");
    const rows = await ledger(user.id);
    expect(rows.map((r) => r.ref).sort()).toEqual(["2026-10-25", "2026-10-26"]);
    expect(rows.every((r) => r.points === 10 && r.source === "workout")).toBe(true);
  });
});

describe("check-in points", () => {
  it("awards 5 points at most once per ISO week", async () => {
    const { user } = await member("pts-checkin-week");
    await addCheckIn(user.id, "2026-10-20T08:00:00Z");
    await addCheckIn(user.id, "2026-10-22T08:00:00Z");
    const rows = await ledger(user.id);
    expect(rows).toEqual([{ source: "checkin", ref: "2026-W43", points: 5, created_by: null }]);
  });

  it("uses the Europe/Sofia week (Sunday 23:30 vs Monday 00:30)", async () => {
    const { user } = await member("pts-checkin-sofia");
    await addCheckIn(user.id, "2026-10-25T21:30:00Z");
    await addCheckIn(user.id, "2026-10-25T22:30:00Z");
    const refs = (await ledger(user.id)).map((r) => r.ref).sort();
    expect(refs).toEqual(["2026-W43", "2026-W44"]);
  });
});

describe("points_ledger access", () => {
  it("members cannot write and see only their own rows; admins see all", async () => {
    const a = await member("pts-rls-a");
    const b = await member("pts-rls-b");
    await markWorkoutComplete(a.db, a.user.id, freeId);
    await markWorkoutComplete(b.db, b.user.id, freeId);

    const insert = await a.db
      .from("points_ledger")
      .insert({ user_id: a.user.id, source: "admin", ref: "hack", points: 9999 });
    expect(insert.error).not.toBeNull();

    const update = await a.db
      .from("points_ledger")
      .update({ points: 9999 })
      .eq("user_id", a.user.id)
      .select();
    expect(update.error !== null || (update.data ?? []).length === 0).toBe(true);

    const del = await a.db.from("points_ledger").delete().eq("user_id", a.user.id).select();
    expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);

    const rowsA = await ledger(a.user.id);
    expect(rowsA).toHaveLength(1);
    expect(rowsA[0]!.points).toBe(10);

    const own = await a.db.from("points_ledger").select("user_id");
    expect(own.error).toBeNull();
    expect(new Set(own.data!.map((r) => r.user_id))).toEqual(new Set([a.user.id]));

    const all = await boss
      .from("points_ledger")
      .select("user_id")
      .in("user_id", [a.user.id, b.user.id]);
    expect(all.error).toBeNull();
    expect(new Set(all.data!.map((r) => r.user_id))).toEqual(new Set([a.user.id, b.user.id]));
  });

  it("anon cannot read the ledger", async () => {
    const { data, error } = await anonClient().from("points_ledger").select("id").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

describe("member_points", () => {
  it("lets a member read only her own total; admins read anyone's", async () => {
    const a = await member("pts-mp-a");
    const b = await member("pts-mp-b");
    await markWorkoutComplete(a.db, a.user.id, freeId);

    const mine = await a.db.rpc("member_points", { uid: a.user.id }).single();
    expect(mine.error).toBeNull();
    expect(mine.data).toEqual({ points: 10, level: 1 });

    const other = await b.db.rpc("member_points", { uid: a.user.id });
    expect(other.error?.code).toBe("42501");

    const asAdmin = await boss.rpc("member_points", { uid: a.user.id }).single();
    expect(asAdmin.error).toBeNull();
    expect(asAdmin.data).toEqual({ points: 10, level: 1 });

    const empty = await b.db.rpc("member_points", { uid: b.user.id }).single();
    expect(empty.data).toEqual({ points: 0, level: 1 });
  });
});

describe("admin_adjust_points", () => {
  it("is admin-only, validates input and changes the total", async () => {
    const a = await member("pts-adjust");

    const byMember = await a.db.rpc("admin_adjust_points", {
      p_user_id: a.user.id,
      p_points: 100,
      p_reason: "self",
    });
    expect(byMember.error?.code).toBe("42501");

    const noReason = await boss.rpc("admin_adjust_points", {
      p_user_id: a.user.id,
      p_points: 30,
      p_reason: "  ",
    });
    expect(noReason.error?.code).toBe("22023");

    const zero = await boss.rpc("admin_adjust_points", {
      p_user_id: a.user.id,
      p_points: 0,
      p_reason: "nothing",
    });
    expect(zero.error?.code).toBe("22023");

    const tooMany = await boss.rpc("admin_adjust_points", {
      p_user_id: a.user.id,
      p_points: 10001,
      p_reason: "too many",
    });
    expect(tooMany.error?.code).toBe("22023");

    const unknown = await boss.rpc("admin_adjust_points", {
      p_user_id: crypto.randomUUID(),
      p_points: 5,
      p_reason: "ghost",
    });
    expect(unknown.error?.code).toBe("P0002");

    const before = (await boss.rpc("member_points", { uid: a.user.id }).single()).data!;
    const ok = await boss.rpc("admin_adjust_points", {
      p_user_id: a.user.id,
      p_points: 30,
      p_reason: "Бонус за предизвикателство",
    });
    expect(ok.error).toBeNull();
    expect(typeof ok.data).toBe("string");
    const after = (await boss.rpc("member_points", { uid: a.user.id }).single()).data!;
    expect(after.points - before.points).toBe(30);

    const { data: row } = await admin
      .from("points_ledger")
      .select("source, points, reason, created_by")
      .eq("id", ok.data!)
      .single();
    expect(row).toMatchObject({
      source: "admin",
      points: 30,
      reason: "Бонус за предизвикателство",
    });
    expect(row!.created_by).not.toBeNull();

    // A correction cannot take the total below zero.
    const total = (await boss.rpc("member_points", { uid: a.user.id }).single()).data!.points;
    const tooLow = await boss.rpc("admin_adjust_points", {
      p_user_id: a.user.id,
      p_points: -(total + 1),
      p_reason: "too low",
    });
    expect(tooLow.error?.code).toBe("22023");
    const exact = await boss.rpc("admin_adjust_points", {
      p_user_id: a.user.id,
      p_points: -total,
      p_reason: "to zero",
    });
    expect(exact.error).toBeNull();

    // The adjustment is audited.
    const audit = await admin.from("audit_log").select("action").eq("target_id", ok.data!);
    expect(audit.data).toEqual([{ action: "insert" }]);
  });
});

describe("level_for_points", () => {
  it.each([
    [0, 1],
    [49, 1],
    [50, 2],
    [119, 2],
    [120, 3],
    [219, 3],
    [220, 4],
    [350, 5],
    [519, 5],
    [520, 6],
    [730, 7],
    [980, 8],
    [1270, 9],
    [1599, 9],
    [1600, 10],
    [5000, 10],
    [-20, 1],
  ])("%i points → level %i", async (points, level) => {
    const { data, error } = await boss.rpc("level_for_points", { p: points });
    expect(error).toBeNull();
    expect(data).toBe(level);
  });
});

describe("exclusive workouts", () => {
  it("can_watch requires the member level; admins are unaffected", async () => {
    const a = await member("pts-exclusive");
    await grantAccess(admin, a.user.id);
    const workoutId = await createWorkout(admin, {
      title: "Ексклузивна",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      publish_at: new Date(Date.now() - 60_000).toISOString(),
      min_member_level: 6,
    });

    const locked = await a.db.rpc("can_watch", { p_workout_id: workoutId });
    expect(locked.error).toBeNull();
    expect(locked.data).toBe(false);
    const media = await a.db.from("workout_media").select("video_url").eq("workout_id", workoutId);
    expect(media.data).toEqual([]);

    const adj = await boss.rpc("admin_adjust_points", {
      p_user_id: a.user.id,
      p_points: 520,
      p_reason: "test level 6",
    });
    expect(adj.error).toBeNull();

    const open = await a.db.rpc("can_watch", { p_workout_id: workoutId });
    expect(open.data).toBe(true);

    const asAdmin = await boss.rpc("can_watch", { p_workout_id: workoutId });
    expect(asAdmin.data).toBe(true);
  });

  it("level alone does not unlock a paid workout without access", async () => {
    const a = await member("pts-exclusive-noaccess");
    const workoutId = await createWorkout(admin, {
      title: "Ексклузивна без достъп",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      publish_at: new Date(Date.now() - 60_000).toISOString(),
      min_member_level: 2,
    });
    await boss.rpc("admin_adjust_points", {
      p_user_id: a.user.id,
      p_points: 100,
      p_reason: "level 2",
    });
    const res = await a.db.rpc("can_watch", { p_workout_id: workoutId });
    expect(res.data).toBe(false);
  });

  it("rejects min_member_level outside 2..10", async () => {
    const { error } = await admin.from("workouts").insert({
      title: "Грешно ниво",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      min_member_level: 1,
    });
    expect(error?.code).toBe("23514");
  });

  it("allows a min level only on regular workouts", async () => {
    for (const kind of ["starter", "free"] as const) {
      const { error } = await admin.from("workouts").insert({
        title: `Ексклузивна ${kind}`,
        kind,
        level: null,
        duration_min: 20,
        min_member_level: 3,
      });
      expect(error?.code).toBe("23514");
    }
    const ok = await admin.from("workouts").insert({
      title: "Обикновена с ниво",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      min_member_level: 3,
    });
    expect(ok.error).toBeNull();
  });

  it("next_drop_at ignores exclusive workouts", async () => {
    const a = await member("pts-exclusive-drop");
    const soon = new Date(Date.now() + 20_000).toISOString();
    await createWorkout(admin, {
      title: "Бонус скоро",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      publish_at: soon,
      min_member_level: 5,
    });
    const { data, error } = await a.db.rpc("next_drop_at", { p_level: "beginner" });
    expect(error).toBeNull();
    expect(data === null ? null : Date.parse(data)).not.toBe(Date.parse(soon));
  });
});

describe("rewards_given", () => {
  it("is admin-managed; members read only their own", async () => {
    const a = await member("pts-reward-a");
    const b = await member("pts-reward-b");

    const byMember = await a.db.from("rewards_given").insert({ user_id: a.user.id, level: 4 });
    expect(byMember.error).not.toBeNull();

    const bad = await boss.from("rewards_given").insert({ user_id: a.user.id, level: 5 });
    expect(bad.error?.code).toBe("23514");

    const ok = await boss.from("rewards_given").insert([
      { user_id: a.user.id, level: 4, note: "код ABC" },
      { user_id: b.user.id, level: 8 },
    ]);
    expect(ok.error).toBeNull();

    const own = await a.db.from("rewards_given").select("user_id, level");
    expect(own.data).toEqual([{ user_id: a.user.id, level: 4 }]);

    const upd = await a.db
      .from("rewards_given")
      .update({ note: "x" })
      .eq("user_id", a.user.id)
      .select();
    expect(upd.error !== null || (upd.data ?? []).length === 0).toBe(true);

    const del = await boss
      .from("rewards_given")
      .delete()
      .eq("user_id", b.user.id)
      .eq("level", 8)
      .select();
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
  });
});

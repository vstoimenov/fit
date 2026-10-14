import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createAdminUser,
  anonClient,
  createUser,
  createWorkout,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let paidId: string;
let futureId: string;
let freeId: string;

const day = 86_400_000;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

beforeAll(async () => {
  admin = adminClient();
  freeId = await freeWorkoutId(admin);
  paidId = await createWorkout(admin, {
    title: "Платена",
    kind: "regular",
    level: "beginner",
    duration_min: 20,
    publish_at: iso(-day),
  });
  futureId = await createWorkout(admin, {
    title: "Бъдеща",
    kind: "regular",
    level: "beginner",
    duration_min: 20,
    publish_at: iso(day),
  });
});

/** Rows the client sees for a workout's media. Fails the test on any query error, so "hidden" can never mean "broken". */
async function mediaRows(db: TypedClient, workoutId: string): Promise<number> {
  const { data, error } = await db
    .from("workout_media")
    .select("video_url")
    .eq("workout_id", workoutId);
  expect(error).toBeNull();
  return (data ?? []).length;
}

async function mediaVisible(db: TypedClient, workoutId: string): Promise<boolean> {
  return (await mediaRows(db, workoutId)) === 1;
}

/** The media row really exists, so a "hidden" assertion is hiding something. */
async function expectMediaExists(workoutId: string): Promise<void> {
  expect(await mediaRows(admin, workoutId)).toBe(1);
}

describe("content access", () => {
  it("shows a non-subscriber the free video only", async () => {
    const db = await signedInClient(await createUser(admin, "nosub"));
    await expectMediaExists(freeId);
    await expectMediaExists(paidId);
    expect(await mediaVisible(db, freeId)).toBe(true);
    expect(await mediaVisible(db, paidId)).toBe(false);
    const { data: access, error } = await db.rpc("my_access");
    expect(error).toBeNull();
    expect(access).toBe(false);
  });

  it("lists published workout metadata but never unpublished ones", async () => {
    const db = await signedInClient(await createUser(admin, "meta"));
    const { data: both } = await admin.from("workouts").select("id").in("id", [paidId, futureId]);
    expect(both?.map((r) => r.id).sort()).toEqual([paidId, futureId].sort());
    const { data, error } = await db.from("workouts").select("id").in("id", [paidId, futureId]);
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([paidId]);
  });

  it("hides an unpublished workout's video even from a subscriber", async () => {
    const user = await createUser(admin, "sub-future");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);
    await expectMediaExists(futureId);
    expect(await mediaVisible(db, paidId)).toBe(true);
    expect(await mediaVisible(db, futureId)).toBe(false);
    const { data: access, error } = await db.rpc("my_access");
    expect(error).toBeNull();
    expect(access).toBe(true);
  });

  it("keeps access after cancel until the period ends", async () => {
    await expectMediaExists(paidId);
    const live = await createUser(admin, "cancel-live");
    await grantAccess(admin, live.id, "canceled", { current_period_end: iso(3 * day) });
    expect(await mediaVisible(await signedInClient(live), paidId)).toBe(true);

    const ended = await createUser(admin, "cancel-ended");
    await grantAccess(admin, ended.id, "canceled", { current_period_end: iso(-day) });
    expect(await mediaVisible(await signedInClient(ended), paidId)).toBe(false);
  });

  it("keeps past_due access only during grace", async () => {
    await expectMediaExists(paidId);
    const inGrace = await createUser(admin, "grace-in");
    await grantAccess(admin, inGrace.id, "past_due", { grace_until: iso(day) });
    expect(await mediaVisible(await signedInClient(inGrace), paidId)).toBe(true);

    const expired = await createUser(admin, "grace-out");
    await grantAccess(admin, expired.id, "past_due", { grace_until: iso(-day) });
    expect(await mediaVisible(await signedInClient(expired), paidId)).toBe(false);
  });

  it("gives trialing users access but not users with status none", async () => {
    const trial = await createUser(admin, "trial");
    await grantAccess(admin, trial.id, "trialing");
    expect(await mediaVisible(await signedInClient(trial), paidId)).toBe(true);

    const none = await createUser(admin, "none");
    await grantAccess(admin, none.id, "none");
    expect(await mediaVisible(await signedInClient(none), paidId)).toBe(false);
  });

  it("lets an admin see every video, published or not", async () => {
    const { db } = await createAdminUser(admin, "admin-view");
    expect(await mediaVisible(db, futureId)).toBe(true);
    expect(await mediaVisible(db, paidId)).toBe(true);
    const { data: access, error } = await db.rpc("my_access");
    expect(error).toBeNull();
    expect(access).toBe(true);
  });

  it("refuses direct calls to the service-only access check", async () => {
    const user = await createUser(admin, "rpc");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);
    // Not even for her own, genuinely active, id.
    const own = await db.rpc("has_active_access", { uid: user.id });
    expect(own.error?.code).toBe("42501");
    expect(own.data).toBeNull();
    const other = await db.rpc("has_active_access", { uid: crypto.randomUUID() });
    expect(other.error?.code).toBe("42501");
    const anon = await anonClient().rpc("has_active_access", { uid: user.id });
    expect(anon.error?.code).toBe("42501");
    // The service role can still use it (the function exists and works).
    const service = await admin.rpc("has_active_access", { uid: user.id });
    expect(service.error).toBeNull();
    expect(service.data).toBe(true);
  });

  it("keeps the access helpers away from signed-out visitors", async () => {
    const anon = anonClient();
    const watch = await anon.rpc("can_watch", { p_workout_id: freeId });
    expect(watch.error?.code).toBe("42501");
    const mine = await anon.rpc("my_access");
    expect(mine.error?.code).toBe("42501");
    const drop = await anon.rpc("next_drop_at", { p_level: "beginner" });
    expect(drop.error?.code).toBe("42501");
    // Table SELECT is not revoked for anon, but RLS leaves a visitor nothing to see.
    await expectMediaExists(freeId);
    const media = await anon.from("workout_media").select("video_url");
    expect(media.error).toBeNull();
    expect(media.data).toEqual([]);
  });

  it("reveals only the time of the next drop", async () => {
    const db = await signedInClient(await createUser(admin, "drop"));
    const { data: upcoming } = await admin
      .from("workouts")
      .select("publish_at")
      .eq("kind", "regular")
      .eq("level", "beginner")
      .gt("publish_at", new Date().toISOString())
      .order("publish_at", { ascending: true })
      .limit(1)
      .single();
    expect(upcoming?.publish_at).toBeTruthy();

    const { data, error } = await db.rpc("next_drop_at", { p_level: "beginner" });
    expect(error).toBeNull();
    expect(typeof data).toBe("string");
    expect(Date.parse(data as string)).toBeGreaterThan(Date.now());
    expect(Date.parse(data as string)).toBe(Date.parse(upcoming!.publish_at!));
  });

  it("rejects provider thumbnails that would leak the video ID", async () => {
    const { error } = await admin
      .from("workouts")
      .update({ thumbnail_url: "https://i.ytimg.com/vi/ml6cT4AZdqI/hqdefault.jpg" })
      .eq("id", paidId);
    expect(error?.code).toBe("23514");
    const { data } = await admin.from("workouts").select("thumbnail_url").eq("id", paidId).single();
    expect(data?.thumbnail_url).toBeNull();

    const ok = await admin
      .from("workouts")
      .update({ thumbnail_url: "https://cdn.example.test/thumbs/paid.jpg" })
      .eq("id", paidId);
    expect(ok.error).toBeNull();
  });

  it("enforces level, starter and single-free rules", async () => {
    const regularNoLevel = await admin
      .from("workouts")
      .insert({ title: "x", kind: "regular", duration_min: 5 });
    expect(regularNoLevel.error?.code).toBe("23514");
    const starterNoOrder = await admin
      .from("workouts")
      .insert({ title: "x", kind: "starter", duration_min: 5 });
    expect(starterNoOrder.error?.code).toBe("23514");
    const secondFree = await admin
      .from("workouts")
      .insert({ title: "x", kind: "free", duration_min: 5 });
    expect(secondFree.error?.code).toBe("23505");
  });

  it("lets no client write content", async () => {
    const user = await createUser(admin, "writer");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);

    const insert = await db
      .from("workouts")
      .insert({ title: "x", kind: "regular", level: "pro", duration_min: 5 });
    expect(insert.error?.code).toBe("42501");

    // Clients hold the table privileges now (admins need them), so RLS answers with "no row visible
    // to write" rather than an error: assert nothing was affected, then that nothing changed.
    const update = await db
      .from("workouts")
      .update({ title: "hacked" })
      .eq("id", paidId)
      .select("id");
    expect(update.error).toBeNull();
    expect(update.data).toEqual([]);
    const del = await db.from("workouts").delete().eq("id", paidId).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toEqual([]);
    const media = await db
      .from("workout_media")
      .update({ video_url: "https://example.test/hacked" })
      .eq("workout_id", paidId)
      .select("workout_id");
    expect(media.error).toBeNull();
    expect(media.data).toEqual([]);
    const sub = await db
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", user.id)
      .select("user_id");
    expect(sub.error).toBeNull();
    expect(sub.data).toEqual([]);
    const plan = await db.from("plans").update({ price_cents: 1 }).neq("name", "").select("id");
    expect(plan.error).toBeNull();
    expect(plan.data).toEqual([]);

    const { data: mediaAfter } = await admin
      .from("workout_media")
      .select("video_url")
      .eq("workout_id", paidId);
    expect(mediaAfter?.every((m) => !m.video_url.includes("hacked"))).toBe(true);
    const { data: subAfter } = await admin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .single();
    expect(subAfter?.status).toBe("active");
    const { data: plansAfter } = await admin.from("plans").select("price_cents");
    expect(plansAfter?.some((pl) => pl.price_cents === 1)).toBe(false);

    const { data } = await admin.from("workouts").select("title").eq("id", paidId).single();
    expect(data?.title).toBe("Платена");
    const { data: stillThere } = await admin
      .from("workouts")
      .select("id")
      .eq("title", "x")
      .maybeSingle();
    expect(stillThere).toBeNull();
  });

  it("shows each user only her own subscription", async () => {
    const a = await createUser(admin, "subs-a");
    const b = await createUser(admin, "subs-b");
    await grantAccess(admin, a.id);
    await grantAccess(admin, b.id);
    const { data, error } = await (await signedInClient(a)).from("subscriptions").select("user_id");
    expect(error).toBeNull();
    expect(data?.map((r) => r.user_id)).toEqual([a.id]);
  });

  it("shows active plans to visitors and hides inactive ones", async () => {
    const hidden = await admin
      .from("plans")
      .insert({ name: "Скрит", interval: "month", price_cents: 100, active: false })
      .select("id")
      .single();
    expect(hidden.error).toBeNull();
    const { data, error } = await anonClient().from("plans").select("id, name, active");
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((p) => p.active)).toBe(true);
    expect(data?.some((p) => p.id === hidden.data!.id)).toBe(false);
  });
});

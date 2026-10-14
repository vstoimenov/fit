import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createAal1Admin,
  createAdminUser,
  createUser,
  createWorkout,
  freeWorkoutId,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "rep-admin")).db;
});

interface Dashboard {
  visits: { today: number; d7: number; d30: number; unique_d30: number };
  sources: { source: string; visits: number }[];
  funnel: { visitors: number; signups: number; free_done: number; paid: number };
  registrations: { d7: number; d30: number };
  subscriptions: { active: number; mrr_cents: number; canceled_30: number };
  top_workouts: { id: string; title: string; completions: number }[];
}

async function subscriptionsNow() {
  const { data, error } = await boss.rpc("admin_dashboard", {});
  expect(error).toBeNull();
  return (data as unknown as Dashboard).subscriptions;
}

async function statsFor(email: string) {
  const { data, error } = await boss.rpc("admin_client_stats", { p_search: email });
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  return data![0]!;
}

describe("admin_client_stats", () => {
  it("is refused to aal1 admins and clients", async () => {
    const half = await createAal1Admin(admin, "rep-half");
    const { error } = await half.db.rpc("admin_client_stats", {});
    expect(error?.code).toBe("42501");

    const client = await signedInClient(await createUser(admin, "rep-client"));
    expect((await client.rpc("admin_client_stats", {})).error?.code).toBe("42501");
    expect((await client.rpc("admin_dashboard", {})).error?.code).toBe("42501");
    expect((await anonClient().rpc("admin_client_stats", {})).error?.code).toBe("42501");
    expect((await anonClient().rpc("admin_dashboard", {})).error?.code).toBe("42501");
  });

  it("counts recent workouts, minutes and the 14-day completion rate", async () => {
    const user = await createUser(admin, "rep-count", { name: "Мила" });
    await admin
      .from("profiles")
      .update({ level: "pro", joined_at: ago(40) })
      .eq("id", user.id);
    const w1 = await createWorkout(admin, {
      title: "R1",
      kind: "regular",
      level: "pro",
      duration_min: 30,
      publish_at: ago(10),
    });
    const w2 = await createWorkout(admin, {
      title: "R2",
      kind: "regular",
      level: "pro",
      duration_min: 40,
      publish_at: ago(3),
    });
    const free = await freeWorkoutId(admin);
    for (const [workout_id, at] of [
      [w1, ago(9)],
      [w2, ago(2)],
      [free, ago(20)],
    ] as const) {
      const { error } = await admin
        .from("workout_completions")
        .insert({ user_id: user.id, workout_id, completed_at: at });
      expect(error).toBeNull();
    }
    const row = await statsFor(user.email);
    expect(row).toMatchObject({
      name: "Мила",
      total_done: 3,
      done_7: 1,
      done_30: 3,
      minutes_7: 40,
      done_regular_14: 2,
    });
    expect(row.published_14).toBeGreaterThanOrEqual(2);
    expect(row.has_access).toBe(false);
  });

  it("flags a paying client with no workout yet, and reports a snooze", async () => {
    const user = await createUser(admin, "rep-paid");
    await admin
      .from("subscriptions")
      .insert({ user_id: user.id, provider: "stripe", status: "active" });
    const until = new Date(Date.now() + 3 * day).toISOString();
    await boss
      .from("client_notes")
      .insert({ user_id: user.id, kind: "snooze", snooze_until: until });
    const row = await statsFor(user.email);
    expect(row.paid_without_workout).toBe(true);
    expect(row.has_access).toBe(true);
    expect(Date.parse(row.snoozed_until!)).toBe(Date.parse(until));
  });

  it("lists clients only and reports the total", async () => {
    const { data, error } = await boss.rpc("admin_client_stats", { p_limit: 5 });
    expect(error).toBeNull();
    expect(data!.length).toBeLessThanOrEqual(5);
    expect(Number(data![0]!.total_count)).toBeGreaterThanOrEqual(data!.length);
    const { data: admins } = await admin
      .from("profiles")
      .select("email")
      .eq("role", "admin")
      .limit(1);
    const { data: found } = await boss.rpc("admin_client_stats", { p_search: admins![0]!.email });
    expect(found).toEqual([]);
  });
});

describe("admin_dashboard", () => {
  // A window far in the future that only this run fills: a random day in a random year, so rows from earlier
  // runs (or other test files) never fall inside it. Everything this run inserts into it is removed afterwards.
  const windowStart =
    Date.UTC(2100 + Math.floor(Math.random() * 6000), 0, 1) + Math.floor(Math.random() * 360) * day;
  const now = new Date(windowStart + 12 * 3_600_000).toISOString();
  const at = (daysBefore: number) => new Date(Date.parse(now) - daysBefore * day).toISOString();
  const anonIds: string[] = [];
  const userIds: string[] = [];

  afterAll(async () => {
    if (anonIds.length) await admin.from("visits").delete().in("anon_id", anonIds);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it("is refused to non-admins", async () => {
    const half = await createAal1Admin(admin, "rep-dash-half");
    const { error } = await half.db.rpc("admin_dashboard", { p_now: now });
    expect(error?.code).toBe("42501");
  });

  it("counts visits, sources, sign-ups, the funnel and top workouts in the window", async () => {
    const anonA = crypto.randomUUID();
    const anonB = crypto.randomUUID();
    anonIds.push(anonA, anonB);
    const rows = [
      {
        anon_id: anonA,
        path: "/",
        device: "mobile",
        created_at: at(0.1),
        utm: { utm_source: "meta" },
      },
      { anon_id: anonA, path: "/start", device: "mobile", created_at: at(0.05), utm: null },
      {
        anon_id: anonB,
        path: "/",
        device: "desktop",
        created_at: at(5),
        referrer: "https://www.google.com/search?q=x",
        utm: null,
      },
      { anon_id: anonB, path: "/", device: "desktop", created_at: at(40), utm: null },
    ];
    expect((await admin.from("visits").insert(rows)).error).toBeNull();

    const signup = await createUser(admin, "rep-funnel");
    userIds.push(signup.id);
    await admin
      .from("profiles")
      .update({ joined_at: at(2) })
      .eq("id", signup.id);
    const free = await freeWorkoutId(admin);
    await admin
      .from("workout_completions")
      .insert({ user_id: signup.id, workout_id: free, completed_at: at(2) });
    await admin
      .from("subscriptions")
      .insert({ user_id: signup.id, provider: "stripe", status: "active" });

    const { data, error } = await boss.rpc("admin_dashboard", { p_now: now });
    expect(error).toBeNull();
    const d = data as unknown as Dashboard;
    expect(d.visits).toMatchObject({ d7: 3, d30: 3, unique_d30: 2 });
    expect(d.visits.today).toBeGreaterThanOrEqual(1);
    expect(d.sources).toEqual(
      expect.arrayContaining([
        { source: "meta", visits: 1 },
        { source: "www.google.com", visits: 1 },
      ]),
    );
    expect(d.funnel).toMatchObject({ visitors: 2, signups: 1, free_done: 1, paid: 1 });
    expect(d.registrations).toMatchObject({ d7: 1, d30: 1 });
    expect(d.top_workouts[0]).toMatchObject({ id: free, completions: 1 });
  });

  it("reports active subscriptions and MRR right now, ignoring manual grants", async () => {
    const before = await subscriptionsNow();
    const { data: plan } = await admin
      .from("plans")
      .select("id, price_cents")
      .eq("interval", "year")
      .single();
    const paid = await createUser(admin, "rep-mrr");
    await admin
      .from("subscriptions")
      .insert({ user_id: paid.id, provider: "stripe", status: "active", plan_id: plan!.id });
    const comp = await createUser(admin, "rep-comp");
    await admin
      .from("subscriptions")
      .insert({ user_id: comp.id, provider: "manual", status: "active", plan_id: plan!.id });
    const after = await subscriptionsNow();
    expect(after.active - before.active).toBe(1);
    expect(after.mrr_cents - before.mrr_cents).toBe(Math.round(plan!.price_cents / 12));
  });
});

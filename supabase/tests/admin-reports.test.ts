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
  sources: { source: string; visitors: number }[];
  funnel: { visitors: number; signups: number; free_done: number; paid: number };
  registrations: { d7: number; d30: number };
  subscriptions: { active: number; mrr_cents: number; canceled_30: number };
  top_workouts: { id: string; title: string; completions: number }[];
}

type Visit = {
  anon_id: string;
  path: string;
  device: string;
  created_at: string;
  referrer?: string | null;
  utm?: { utm_source: string } | null;
};

async function dashboard(args: { p_now?: string; p_own_host?: string }) {
  const { data, error } = await boss.rpc("admin_dashboard", args);
  expect(error).toBeNull();
  return data as unknown as Dashboard;
}

const rand = () => Math.random().toString(36).slice(2, 10);

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

  it("flags a paying client with no workout yet, and reports the latest snooze", async () => {
    const user = await createUser(admin, "rep-paid");
    await admin
      .from("subscriptions")
      .insert({ user_id: user.id, provider: "stripe", status: "active" });
    const long = new Date(Date.now() + 10 * day).toISOString();
    const short = new Date(Date.now() + 3 * day).toISOString();
    expect(
      (
        await boss
          .from("client_notes")
          .insert({ user_id: user.id, kind: "snooze", snooze_until: long })
      ).error,
    ).toBeNull();
    expect(
      (
        await boss
          .from("client_notes")
          .insert({ user_id: user.id, kind: "snooze", snooze_until: short })
      ).error,
    ).toBeNull();
    const row = await statsFor(user.email);
    expect(row.paid_without_workout).toBe(true);
    expect(row.has_access).toBe(true);
    // A shorter re-snooze made later wins over an earlier, longer one.
    expect(Date.parse(row.snoozed_until!)).toBe(Date.parse(short));
  });

  it("a paying client is only 'without workout' until a non-free workout is done", async () => {
    const freeOnly = await createUser(admin, "rep-freeonly");
    const regular = await createUser(admin, "rep-regdone");
    const free = await freeWorkoutId(admin);
    const w = await createWorkout(admin, {
      title: "Paid1",
      kind: "regular",
      level: "pro",
      duration_min: 20,
      publish_at: ago(1),
    });
    for (const u of [freeOnly, regular]) {
      expect(
        (
          await admin
            .from("subscriptions")
            .insert({ user_id: u.id, provider: "revolut", status: "active" })
        ).error,
      ).toBeNull();
    }
    await admin.from("workout_completions").insert({ user_id: freeOnly.id, workout_id: free });
    await admin.from("workout_completions").insert({ user_id: regular.id, workout_id: w });
    expect((await statsFor(freeOnly.email)).paid_without_workout).toBe(true);
    expect((await statsFor(regular.email)).paid_without_workout).toBe(false);
  });

  it("counts the 14-day workouts from the end of the starter week when it is set", async () => {
    const plain = await createUser(admin, "rep-nostarter");
    const starter = await createUser(admin, "rep-starter");
    await admin
      .from("profiles")
      .update({ level: "advanced", joined_at: ago(40) })
      .eq("id", plain.id);
    await admin
      .from("profiles")
      .update({ level: "advanced", joined_at: ago(40), starter_week_done_at: ago(1) })
      .eq("id", starter.id);
    const before = [await statsFor(plain.email), await statsFor(starter.email)];

    const early = await createWorkout(admin, {
      title: "Early",
      kind: "regular",
      level: "advanced",
      duration_min: 20,
      publish_at: ago(10),
    });
    const late = await createWorkout(admin, {
      title: "Late",
      kind: "regular",
      level: "advanced",
      duration_min: 20,
      publish_at: ago(0.2),
    });
    for (const u of [plain, starter]) {
      for (const workout_id of [early, late]) {
        expect(
          (await admin.from("workout_completions").insert({ user_id: u.id, workout_id })).error,
        ).toBeNull();
      }
    }
    const after = [await statsFor(plain.email), await statsFor(starter.email)];
    // Without a starter week both workouts count; with one only the workout published after it does.
    expect(after[0]!.published_14! - before[0]!.published_14!).toBe(2);
    expect(after[1]!.published_14! - before[1]!.published_14!).toBe(1);
    expect(after[0]!.done_regular_14! - before[0]!.done_regular_14!).toBe(2);
    expect(after[1]!.done_regular_14! - before[1]!.done_regular_14!).toBe(1);
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

  it("pages with limit and offset while total_count stays the full count", async () => {
    const tag = `rep-pg-${rand()}`;
    const made = [];
    for (let i = 0; i < 3; i++) made.push(await createUser(admin, tag));
    const page = async (p_limit: number, p_offset: number) => {
      const { data, error } = await boss.rpc("admin_client_stats", {
        p_search: tag,
        p_limit,
        p_offset,
      });
      expect(error).toBeNull();
      return data!;
    };
    const first = await page(2, 0);
    const second = await page(2, 2);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(1);
    expect(first.map((r) => Number(r.total_count))).toEqual([3, 3]);
    expect(Number(second[0]!.total_count)).toBe(3);
    // Newest first, and the pages do not overlap.
    expect([...first, ...second].map((r) => r.user_id)).toEqual(made.map((u) => u.id).reverse());
    expect(await page(2, 3)).toEqual([]);
  });

  it("matches % and _ in the search literally", async () => {
    const tag = rand();
    const underscore = await createUser(admin, `lit_${tag}`);
    const lookalike = await createUser(admin, `litX${tag}`);
    const found = (await boss.rpc("admin_client_stats", { p_search: `lit_${tag}` })).data!;
    expect(found.map((r) => r.user_id)).toEqual([underscore.id]);
    expect(found.map((r) => r.user_id)).not.toContain(lookalike.id);

    const sale = await createUser(admin, "rep-pct", { name: `Sale 50%${tag}` });
    await createUser(admin, "rep-pct2", { name: `Sale 50 off${tag}` });
    const pct = (await boss.rpc("admin_client_stats", { p_search: `50%${tag}` })).data!;
    expect(pct.map((r) => r.user_id)).toEqual([sale.id]);
  });
});

describe("admin_dashboard", () => {
  // Every test gets its own window far in the future: a random January day in a random year, so rows from
  // earlier runs, other tests and other files never fall inside it (and January keeps Sofia at UTC+2).
  // Everything inserted into a window is removed afterwards.
  function windowAt() {
    const start = Date.UTC(
      2100 + Math.floor(Math.random() * 6000),
      0,
      1 + Math.floor(Math.random() * 40),
    );
    const now = new Date(start + 12 * 3_600_000).toISOString();
    const at = (daysBefore: number) => new Date(Date.parse(now) - daysBefore * day).toISOString();
    return { start, now, at };
  }
  const anonIds: string[] = [];
  const userIds: string[] = [];
  const hourMs = 3_600_000;

  async function visit(rows: Visit[]) {
    anonIds.push(...rows.map((r) => r.anon_id));
    expect((await admin.from("visits").insert(rows)).error).toBeNull();
  }
  async function windowUser(label: string, joinedAt?: string) {
    const u = await createUser(admin, label);
    userIds.push(u.id);
    if (joinedAt) await admin.from("profiles").update({ joined_at: joinedAt }).eq("id", u.id);
    return u;
  }

  afterAll(async () => {
    if (anonIds.length) await admin.from("visits").delete().in("anon_id", anonIds);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it("is refused to non-admins", async () => {
    const half = await createAal1Admin(admin, "rep-dash-half");
    const { error } = await half.db.rpc("admin_dashboard", { p_now: windowAt().now });
    expect(error?.code).toBe("42501");
  });

  it("counts visits, sources, sign-ups, the funnel and top workouts in the window", async () => {
    const { now, at } = windowAt();
    const anonA = crypto.randomUUID();
    const anonB = crypto.randomUUID();
    // A lands from a Meta ad, then browses three more pages without the tag: still one visitor, one source.
    // B's old visit is outside the window, so it does not decide B's source.
    await visit([
      {
        anon_id: anonA,
        path: "/",
        device: "mobile",
        created_at: at(0.1),
        utm: { utm_source: "Meta" },
      },
      { anon_id: anonA, path: "/a", device: "mobile", created_at: at(0.08), utm: null },
      { anon_id: anonA, path: "/b", device: "mobile", created_at: at(0.06), utm: null },
      { anon_id: anonA, path: "/start", device: "mobile", created_at: at(0.05), utm: null },
      {
        anon_id: anonB,
        path: "/",
        device: "desktop",
        created_at: at(5),
        referrer: "https://www.google.com/search?q=x",
        utm: null,
      },
      {
        anon_id: anonB,
        path: "/",
        device: "desktop",
        created_at: at(40),
        utm: { utm_source: "old" },
      },
    ]);

    const signup = await windowUser("rep-funnel", at(2));
    const never = await windowUser("rep-never", at(3));
    const free = await freeWorkoutId(admin);
    await admin
      .from("workout_completions")
      .insert({ user_id: signup.id, workout_id: free, completed_at: at(2) });
    await admin
      .from("subscriptions")
      .insert({ user_id: signup.id, provider: "stripe", status: "active" });
    // A subscription row that never started must not count as a payer.
    await admin
      .from("subscriptions")
      .insert({ user_id: never.id, provider: "stripe", status: "none" });

    const d = await dashboard({ p_now: now });
    expect(d.visits).toMatchObject({ today: 4, d7: 5, d30: 5, unique_d30: 2 });
    expect(d.sources).toEqual([
      { source: "google.com", visitors: 1 },
      { source: "meta", visitors: 1 },
    ]);
    expect(d.funnel).toEqual({ visitors: 2, signups: 2, free_done: 1, paid: 1 });
    expect(d.registrations).toEqual({ d7: 2, d30: 2 });
    expect(d.top_workouts[0]).toMatchObject({ id: free, completions: 1 });
  });

  it("counts a visit as today by the Sofia calendar day", async () => {
    const { start, now } = windowAt();
    // In January Sofia is UTC+2, so its day began at 22:00Z the evening before.
    const justAfterMidnight = new Date(start - 90 * 60_000).toISOString(); // 22:30Z = 00:30 Sofia
    const justBeforeMidnight = new Date(start - 150 * 60_000).toISOString(); // 21:30Z = 23:30 Sofia, the day before
    await visit([
      { anon_id: crypto.randomUUID(), path: "/", device: "mobile", created_at: justAfterMidnight },
      { anon_id: crypto.randomUUID(), path: "/", device: "mobile", created_at: justBeforeMidnight },
    ]);
    const d = await dashboard({ p_now: now });
    expect(d.visits.today).toBe(1);
    expect(d.visits.d7).toBe(2);
  });

  it("treats the site's own host as direct, whatever its case or www prefix", async () => {
    const { now, at } = windowAt();
    const row = (
      path: string,
      hoursAgo: number,
      referrer: string | null,
      utm?: { utm_source: string },
    ) => ({
      anon_id: crypto.randomUUID(),
      path,
      device: "desktop",
      created_at: new Date(Date.parse(at(0)) - hoursAgo * hourMs).toISOString(),
      referrer,
      utm: utm ?? null,
    });
    await visit([
      row("/", 1, "https://www.Fit.Example.test/pricing"),
      row("/", 2, "https://fit.example.test/"),
      row("/", 3, null),
      row("/", 4, "https://l.facebook.com/l.php?u=x"),
      // A utm tag beats the referrer, even an own-host one.
      row("/", 5, "https://fit.example.test/", { utm_source: "newsletter" }),
    ]);
    const d = await dashboard({ p_now: now, p_own_host: "WWW.fit.example.test" });
    expect(d.sources).toEqual([
      { source: "direct", visitors: 3 },
      { source: "l.facebook.com", visitors: 1 },
      { source: "newsletter", visitors: 1 },
    ]);
    // Without an own host, the referrer host shows up as itself.
    const plain = await dashboard({ p_now: now });
    expect(plain.sources).toContainEqual({ source: "fit.example.test", visitors: 2 });
  });

  it("counts a paid subscription canceled in the window, and nothing else", async () => {
    const { now, at } = windowAt();
    const mk = async (label: string, provider: "stripe" | "manual", canceledAt: string) => {
      const u = await windowUser(label);
      const { error } = await admin
        .from("subscriptions")
        .insert({ user_id: u.id, provider, status: "canceled", canceled_at: canceledAt });
      expect(error).toBeNull();
    };
    await mk("rep-cx-in", "stripe", at(5));
    await mk("rep-cx-old", "stripe", at(40));
    await mk("rep-cx-comp", "manual", at(5));
    const d = await dashboard({ p_now: now });
    expect(d.subscriptions.canceled_30).toBe(1);
  });

  it("reports active subscriptions and MRR right now, ignoring manual grants and canceled ones", async () => {
    const before = await subscriptionsNow();
    const { data: year } = await admin
      .from("plans")
      .select("id, price_cents")
      .eq("interval", "year")
      .limit(1)
      .single();
    const { data: month } = await admin
      .from("plans")
      .select("id, price_cents")
      .eq("interval", "month")
      .limit(1)
      .single();
    const subs = [
      ["rep-mrr-y", "stripe", "active", year!.id],
      ["rep-mrr-m", "revolut", "active", month!.id],
      ["rep-mrr-t", "stripe", "trialing", month!.id],
      ["rep-mrr-c", "stripe", "canceled", month!.id],
      ["rep-comp", "manual", "active", year!.id],
    ] as const;
    for (const [label, provider, status, plan_id] of subs) {
      const u = await createUser(admin, label);
      const { error } = await admin
        .from("subscriptions")
        .insert({ user_id: u.id, provider, status, plan_id });
      expect(error).toBeNull();
    }
    const after = await subscriptionsNow();
    // Active and MRR cover the same set, so churn can be read as canceled / (active + canceled).
    expect(after.active - before.active).toBe(3);
    expect(after.mrr_cents - before.mrr_cents).toBe(
      Math.round(year!.price_cents / 12) + 2 * month!.price_cents,
    );
  });
});

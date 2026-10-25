import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createAdminUser,
  createUser,
  createWorkout,
  grantAccess,
  signedInClient,
  type TestUser,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let bossId: string;
const createdChallenges: string[] = [];

/** Calendar date in Europe/Sofia, `offsetDays` from today (the database's own day boundary). */
function sofiaDay(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const MSG = {
  window: "Може да отметнеш само днес и вчера.",
  beforeJoin: "Този ден е преди да се включиш.",
  access: "Нужен е активен абонамент.",
  startLock: "Вече има участнички — началото и броят дни не се променят.",
  deleteLock: "Предизвикателство с участнички не може да се изтрие.",
};

type Task = { task: string; workoutId?: string | null };

function tasks(n: number, over: Partial<Task>[] = []): Task[] {
  return Array.from({ length: n }, (_, i) => ({
    task: `Задача ${i + 1}`,
    workoutId: null,
    ...over[i],
  }));
}

interface SaveArgs {
  p_id: string | null;
  p_title: string;
  p_description: string;
  p_start: string;
  p_days: number;
  p_published: boolean;
  p_tasks: Task[];
}

/** By default: running, started 3 days ago (so today is day 4 and yesterday day 3), 10 days. */
async function save(db: TypedClient, over: Partial<SaveArgs> = {}) {
  const args: SaveArgs = {
    p_id: null,
    p_title: "Тестово предизвикателство",
    p_description: "Описание в **Markdown**.",
    p_start: sofiaDay(-3),
    p_days: 10,
    p_published: true,
    p_tasks: tasks(over.p_days ?? 10),
    ...over,
  };
  const res = await db.rpc("admin_save_challenge", args as never);
  if (!res.error && res.data) createdChallenges.push(res.data as unknown as string);
  return res;
}

async function seedChallenge(over: Partial<SaveArgs> = {}): Promise<string> {
  const res = await save(boss, over);
  if (res.error || !res.data) throw res.error ?? new Error("seed challenge failed");
  return res.data as unknown as string;
}

async function member(
  label: string,
  opts: { access?: boolean; name?: string } = {},
): Promise<{ user: TestUser; db: TypedClient }> {
  const user = await createUser(admin, label);
  if (opts.name !== undefined) {
    const { error } = await admin.from("profiles").update({ name: opts.name }).eq("id", user.id);
    if (error) throw error;
  }
  if (opts.access ?? true) await grantAccess(admin, user.id);
  return { user, db: await signedInClient(user) };
}

/** A participant row written directly (service role), the only way to give her a past join date. */
async function seedParticipant(challengeId: string, userId: string, joinedOn: string) {
  const { error } = await admin
    .from("challenge_participants")
    .insert({ challenge_id: challengeId, user_id: userId, joined_on: joinedOn });
  if (error) throw error;
}

async function seedTick(challengeId: string, userId: string, day: number) {
  const { error } = await admin
    .from("challenge_ticks")
    .insert({ challenge_id: challengeId, user_id: userId, day });
  if (error) throw error;
}

async function tick(db: TypedClient, userId: string, challengeId: string, day: number) {
  return db
    .from("challenge_ticks")
    .insert({ challenge_id: challengeId, user_id: userId, day })
    .select("day");
}

async function ledger(userId: string) {
  const { data, error } = await admin
    .from("points_ledger")
    .select("source, ref, points")
    .eq("user_id", userId)
    .eq("source", "challenge")
    .order("ref");
  if (error) throw error;
  return data;
}

const DB_CONTAINER = "supabase_db_fit-platform";
/** Superuser SQL against the local stack only; used to plant rows the guards would refuse. */
function psql(sql: string): void {
  execFileSync(
    "docker",
    ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql],
    {
      encoding: "utf8",
      env: { ...process.env, DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "/tmp/dockercfg" },
    },
  );
}

beforeAll(async () => {
  admin = adminClient();
  const a = await createAdminUser(admin, "challenges-admin");
  boss = a.db;
  bossId = a.user.id;
});

afterAll(async () => {
  if (createdChallenges.length) {
    await admin.from("challenge_participants").delete().in("challenge_id", createdChallenges);
    await admin.from("challenges").delete().in("id", createdChallenges);
  }
});

describe("admin_save_challenge", () => {
  it("creates a challenge with its day rows and returns the id", async () => {
    const wid = await createWorkout(admin, {
      title: "Тренировка за предизвикателство",
      duration_min: 20,
      kind: "regular",
      level: "beginner",
      publish_at: new Date(Date.now() - 3600_000).toISOString(),
    });
    const res = await save(boss, {
      p_days: 3,
      p_tasks: tasks(3, [{ workoutId: wid }, {}, { task: "  Изпий вода  " }]),
    });
    expect(res.error).toBeNull();
    const id = res.data as unknown as string;

    const row = await admin.from("challenges").select("*").eq("id", id).single();
    expect(row.data).toMatchObject({
      title: "Тестово предизвикателство",
      days: 3,
      published: true,
      start_date: sofiaDay(-3),
    });
    const days = await admin
      .from("challenge_days")
      .select("day, task, workout_id")
      .eq("challenge_id", id)
      .order("day");
    expect(days.data).toEqual([
      { day: 1, task: "Задача 1", workout_id: wid },
      { day: 2, task: "Задача 2", workout_id: null },
      { day: 3, task: "Изпий вода", workout_id: null },
    ]);
    await admin.from("workouts").delete().eq("id", wid);
  });

  it("writes audit rows on create and on a changed update", async () => {
    const id = await seedChallenge({ p_days: 3 });
    const upd = await save(boss, { p_id: id, p_days: 3, p_title: "Ново заглавие" });
    expect(upd.error).toBeNull();
    const log = await admin
      .from("audit_log")
      .select("actor_id, action, target_type")
      .eq("target_id", id)
      .order("created_at");
    expect(log.data).toEqual([
      { actor_id: bossId, action: "insert", target_type: "challenges" },
      { actor_id: bossId, action: "update", target_type: "challenges" },
    ]);
  });

  it("update replaces the day rows", async () => {
    const id = await seedChallenge({ p_days: 5 });
    const res = await save(boss, {
      p_id: id,
      p_days: 5,
      p_tasks: tasks(5, [{ task: "Първа" }, {}, {}, {}, { task: "Последна" }]),
    });
    expect(res.error).toBeNull();
    expect(res.data).toBe(id);
    const days = await admin
      .from("challenge_days")
      .select("day, task")
      .eq("challenge_id", id)
      .order("day");
    expect(days.data).toHaveLength(5);
    expect(days.data![0]).toEqual({ day: 1, task: "Първа" });
    expect(days.data![4]).toEqual({ day: 5, task: "Последна" });
  });

  it("is refused for a member and an unauthenticated caller", async () => {
    const m = await member("ch-nosave");
    const asMember = await save(m.db, { p_days: 3 });
    expect(asMember.error).not.toBeNull();
    const asAnon = await save(anonClient(), { p_days: 3 });
    expect(asAnon.error).not.toBeNull();
  });

  it("updating a missing challenge fails", async () => {
    const res = await save(boss, { p_id: crypto.randomUUID(), p_days: 3 });
    expect(res.error).not.toBeNull();
  });

  describe("bounds", () => {
    it.each([
      ["title of 2 characters", { p_title: "Аб" }],
      ["title of 81 characters", { p_title: "а".repeat(81) }],
      ["blank title", { p_title: "   " }],
      ["description over 4000", { p_description: "а".repeat(4001) }],
      ["2 days", { p_days: 2, p_tasks: tasks(2) }],
      ["61 days", { p_days: 61, p_tasks: tasks(61) }],
      ["task list shorter than days", { p_days: 5, p_tasks: tasks(4) }],
      ["task list longer than days", { p_days: 5, p_tasks: tasks(6) }],
      ["empty task", { p_days: 3, p_tasks: tasks(3, [{}, { task: "  " }]) }],
      ["task of 201 characters", { p_days: 3, p_tasks: tasks(3, [{ task: "а".repeat(201) }]) }],
      ["start before 2026-01-01", { p_start: "2025-12-31" }],
      ["unknown workout", { p_days: 3, p_tasks: tasks(3, [{ workoutId: crypto.randomUUID() }]) }],
      ["workout id that is not a uuid", { p_days: 3, p_tasks: tasks(3, [{ workoutId: "x" }]) }],
    ] as [string, Partial<SaveArgs>][])("refuses %s", async (_label, over) => {
      const res = await save(boss, over);
      expect(res.error).not.toBeNull();
      expect(res.data).toBeNull();
    });

    it("refuses a workout that is not published yet", async () => {
      const wid = await createWorkout(admin, {
        title: "Чернова за предизвикателство",
        duration_min: 15,
        kind: "regular",
        level: "beginner",
        publish_at: null,
      });
      const res = await save(boss, { p_days: 3, p_tasks: tasks(3, [{ workoutId: wid }]) });
      expect(res.error).not.toBeNull();
      await admin.from("workouts").delete().eq("id", wid);
    });

    it("keeps a since-unpublished workout on the day that already stores it, but refuses it anywhere else", async () => {
      const wid = await createWorkout(admin, {
        title: "По-късно скрита тренировка",
        duration_min: 15,
        kind: "regular",
        level: "beginner",
        publish_at: new Date(Date.now() - 3600_000).toISOString(),
      });
      const created = await save(boss, { p_days: 3, p_tasks: tasks(3, [{ workoutId: wid }]) });
      expect(created.error).toBeNull();
      const id = created.data as unknown as string;
      await admin.from("workouts").update({ publish_at: null }).eq("id", wid);

      // Same day, same workout: hiding the challenge (or editing the text) is not blocked.
      const hide = await save(boss, {
        p_id: id,
        p_days: 3,
        p_published: false,
        p_tasks: tasks(3, [{ workoutId: wid, task: "Нов текст" }]),
      });
      expect(hide.error).toBeNull();
      const stored = await admin
        .from("challenge_days")
        .select("day, task, workout_id")
        .eq("challenge_id", id)
        .order("day");
      expect(stored.data![0]).toEqual({ day: 1, task: "Нов текст", workout_id: wid });

      // Moving it to another day is a new attachment: refused.
      const moved = await save(boss, {
        p_id: id,
        p_days: 3,
        p_tasks: tasks(3, [{}, { workoutId: wid }]),
      });
      expect(moved.error).not.toBeNull();
      // And it is refused on a brand-new challenge.
      const fresh = await save(boss, { p_days: 3, p_tasks: tasks(3, [{ workoutId: wid }]) });
      expect(fresh.error).not.toBeNull();
      await admin.from("challenges").delete().eq("id", id);
      await admin.from("workouts").delete().eq("id", wid);
    });

    it("accepts the edges: 3-character title, 4000-character description, 3 and 60 days, 200-character task", async () => {
      const a = await save(boss, {
        p_title: "Абв",
        p_description: "а".repeat(4000),
        p_days: 3,
        p_tasks: tasks(3, [{ task: "а".repeat(200) }]),
        p_start: "2026-01-01",
      });
      expect(a.error).toBeNull();
      const b = await save(boss, { p_days: 60, p_tasks: tasks(60) });
      expect(b.error).toBeNull();
    });

    it("leaves nothing behind when validation fails midway", async () => {
      const before = await admin
        .from("challenges")
        .select("id", { count: "exact", head: true })
        .eq("title", "Пропаднало предизвикателство");
      const res = await save(boss, {
        p_title: "Пропаднало предизвикателство",
        p_days: 3,
        p_tasks: tasks(3, [{}, {}, { task: "" }]),
      });
      expect(res.error).not.toBeNull();
      const after = await admin
        .from("challenges")
        .select("id", { count: "exact", head: true })
        .eq("title", "Пропаднало предизвикателство");
      expect(after.count).toBe(before.count);
    });
  });
});

describe("table writes", () => {
  it("no client role writes the challenge tables directly", async () => {
    const id = await seedChallenge({ p_days: 3 });
    const m = await member("ch-direct");

    const insMember = await m.db
      .from("challenges")
      .insert({ title: "Хак", description: "", start_date: sofiaDay(), days: 3 });
    expect(insMember.error).not.toBeNull();
    const insBoss = await boss
      .from("challenges")
      .insert({ title: "Хак", description: "", start_date: sofiaDay(), days: 3 });
    expect(insBoss.error).not.toBeNull();
    const updBoss = await boss.from("challenges").update({ title: "Хак" }).eq("id", id);
    expect(updBoss.error).not.toBeNull();
    const dayBoss = await boss
      .from("challenge_days")
      .update({ task: "Хак" })
      .eq("challenge_id", id);
    expect(dayBoss.error).not.toBeNull();
    const partIns = await m.db
      .from("challenge_participants")
      .insert({ challenge_id: id, user_id: m.user.id, joined_on: sofiaDay(-3) });
    expect(partIns.error).not.toBeNull();

    const row = await admin.from("challenges").select("title").eq("id", id).single();
    expect(row.data?.title).toBe("Тестово предизвикателство");
  });
});

describe("visibility", () => {
  it("a member with access sees published challenges and their days, not unpublished ones", async () => {
    const pub = await seedChallenge({ p_days: 3 });
    const hidden = await seedChallenge({ p_days: 3, p_published: false });
    const m = await member("ch-see");

    const rows = await m.db.from("challenges").select("id").in("id", [pub, hidden]);
    expect(rows.data?.map((r) => r.id)).toEqual([pub]);
    const days = await m.db
      .from("challenge_days")
      .select("challenge_id")
      .in("challenge_id", [pub, hidden]);
    expect(new Set(days.data?.map((r) => r.challenge_id))).toEqual(new Set([pub]));
  });

  it("admins see unpublished challenges too", async () => {
    const hidden = await seedChallenge({ p_days: 3, p_published: false });
    const rows = await boss.from("challenges").select("id").eq("id", hidden);
    expect(rows.data).toHaveLength(1);
  });

  it("a member without access and an anonymous visitor see nothing", async () => {
    const pub = await seedChallenge({ p_days: 3 });
    const lapsed = await member("ch-lapsed", { access: false });
    const rows = await lapsed.db.from("challenges").select("id").eq("id", pub);
    expect(rows.data ?? []).toEqual([]);
    const days = await lapsed.db.from("challenge_days").select("day").eq("challenge_id", pub);
    expect(days.data ?? []).toEqual([]);

    const anon = await anonClient().from("challenges").select("id").eq("id", pub);
    expect(anon.error).not.toBeNull();
  });

  it("a participant keeps seeing the challenge after it is unpublished, even without access", async () => {
    const id = await seedChallenge({ p_days: 3 });
    const m = await member("ch-keeps");
    await seedParticipant(id, m.user.id, sofiaDay(-3));
    const other = await member("ch-keeps-other");
    await save(boss, { p_id: id, p_days: 3, p_published: false });

    const mine = await m.db.from("challenges").select("id, published").eq("id", id);
    expect(mine.data).toEqual([{ id, published: false }]);
    const days = await m.db.from("challenge_days").select("day").eq("challenge_id", id);
    expect(days.data).toHaveLength(3);
    const theirs = await other.db.from("challenges").select("id").eq("id", id);
    expect(theirs.data ?? []).toEqual([]);

    await admin.from("subscriptions").update({ status: "canceled" }).eq("user_id", m.user.id);
    const lapsed = await m.db.from("challenges").select("id").eq("id", id);
    expect(lapsed.data).toHaveLength(1);
  });

  it("a member reads only her own participation and ticks", async () => {
    const id = await seedChallenge({ p_days: 5 });
    const a = await member("ch-own-a");
    const b = await member("ch-own-b");
    await seedParticipant(id, a.user.id, sofiaDay(-3));
    await seedParticipant(id, b.user.id, sofiaDay(-3));
    await seedTick(id, a.user.id, 4);
    await seedTick(id, b.user.id, 4);

    const parts = await a.db
      .from("challenge_participants")
      .select("user_id")
      .eq("challenge_id", id);
    expect(parts.data).toEqual([{ user_id: a.user.id }]);
    const ticks = await a.db.from("challenge_ticks").select("user_id").eq("challenge_id", id);
    expect(ticks.data).toEqual([{ user_id: a.user.id }]);
    const adminView = await boss
      .from("challenge_participants")
      .select("user_id")
      .eq("challenge_id", id);
    expect(adminView.data).toHaveLength(2);

    const anon = await anonClient().from("challenge_ticks").select("day");
    expect(anon.error).not.toBeNull();
  });
});

describe("join_challenge", () => {
  it("joins a running challenge with joined_on = today", async () => {
    const id = await seedChallenge();
    const m = await member("ch-join-run");
    const res = await m.db.rpc("join_challenge", { p_id: id });
    expect(res.error).toBeNull();
    const row = await m.db
      .from("challenge_participants")
      .select("*")
      .eq("challenge_id", id)
      .single();
    expect(row.data).toMatchObject({
      user_id: m.user.id,
      joined_on: sofiaDay(),
      show_on_board: true,
    });
  });

  it("joins an upcoming challenge with joined_on = its start date", async () => {
    const id = await seedChallenge({ p_start: sofiaDay(5) });
    const m = await member("ch-join-up");
    expect((await m.db.rpc("join_challenge", { p_id: id })).error).toBeNull();
    const row = await m.db
      .from("challenge_participants")
      .select("joined_on")
      .eq("challenge_id", id)
      .single();
    expect(row.data?.joined_on).toBe(sofiaDay(5));
  });

  it("can join on the last day, not after it", async () => {
    const last = await seedChallenge({ p_start: sofiaDay(-9), p_days: 10 });
    const ended = await seedChallenge({ p_start: sofiaDay(-10), p_days: 10 });
    const m = await member("ch-join-end");
    expect((await m.db.rpc("join_challenge", { p_id: last })).error).toBeNull();
    const late = await m.db.rpc("join_challenge", { p_id: ended });
    expect(late.error).not.toBeNull();
    const rows = await admin
      .from("challenge_participants")
      .select("user_id")
      .eq("challenge_id", ended);
    expect(rows.data ?? []).toEqual([]);
  });

  it("is idempotent and keeps the original joined_on", async () => {
    const id = await seedChallenge();
    const m = await member("ch-join-twice");
    await seedParticipant(id, m.user.id, sofiaDay(-3));
    expect((await m.db.rpc("join_challenge", { p_id: id })).error).toBeNull();
    expect((await m.db.rpc("join_challenge", { p_id: id })).error).toBeNull();
    const rows = await admin
      .from("challenge_participants")
      .select("joined_on")
      .eq("challenge_id", id);
    expect(rows.data).toEqual([{ joined_on: sofiaDay(-3) }]);
  });

  it("is refused without access, for unpublished or missing challenges and for anonymous callers", async () => {
    const id = await seedChallenge();
    const hidden = await seedChallenge({ p_published: false });
    const lapsed = await member("ch-join-lapsed", { access: false });
    const m = await member("ch-join-nope");

    const noAccess = await lapsed.db.rpc("join_challenge", { p_id: id });
    expect(noAccess.error?.message).toContain(MSG.access);
    expect((await m.db.rpc("join_challenge", { p_id: hidden })).error).not.toBeNull();
    expect((await m.db.rpc("join_challenge", { p_id: crypto.randomUUID() })).error).not.toBeNull();
    expect((await anonClient().rpc("join_challenge", { p_id: id })).error).not.toBeNull();
    const rows = await admin
      .from("challenge_participants")
      .select("user_id")
      .in("challenge_id", [id, hidden]);
    expect(rows.data ?? []).toEqual([]);
  });
});

describe("ticks", () => {
  /** Challenge started 3 days ago (today = day 4); she joined on its first day. */
  async function setup(label: string, over: Partial<SaveArgs> = {}) {
    const id = await seedChallenge(over);
    const m = await member(label);
    await seedParticipant(id, m.user.id, over.p_start ?? sofiaDay(-3));
    return { id, ...m };
  }

  it("accepts today and yesterday", async () => {
    const { id, user, db } = await setup("tick-ok");
    const today = await tick(db, user.id, id, 4);
    expect(today.error).toBeNull();
    const yesterday = await tick(db, user.id, id, 3);
    expect(yesterday.error).toBeNull();
    const rows = await db.from("challenge_ticks").select("day").eq("challenge_id", id).order("day");
    expect(rows.data).toEqual([{ day: 3 }, { day: 4 }]);
  });

  it("refuses days older than yesterday and future days", async () => {
    const { id, user, db } = await setup("tick-window");
    for (const day of [1, 2, 5, 10]) {
      const res = await tick(db, user.id, id, day);
      expect(res.error?.message, `day ${day}`).toContain(MSG.window);
    }
    const rows = await admin.from("challenge_ticks").select("day").eq("challenge_id", id);
    expect(rows.data ?? []).toEqual([]);
  });

  it("refuses a day outside 1..N", async () => {
    const id = await seedChallenge({ p_start: sofiaDay(-12), p_days: 10 });
    const m = await member("tick-range");
    await seedParticipant(id, m.user.id, sofiaDay(-12));
    // Day 13 falls on today's date but lies past the last day (10).
    const res = await tick(m.db, m.user.id, id, 13);
    expect(res.error).not.toBeNull();
    expect((await tick(m.db, m.user.id, id, 0)).error).not.toBeNull();
    expect((await tick(m.db, m.user.id, id, -1)).error).not.toBeNull();
  });

  it("refuses a day before she joined, and allows from the join day on", async () => {
    const id = await seedChallenge();
    const m = await member("tick-prejoin");
    expect((await m.db.rpc("join_challenge", { p_id: id })).error).toBeNull();
    const before = await tick(m.db, m.user.id, id, 3);
    expect(before.error?.message).toContain(MSG.beforeJoin);
    const onDay = await tick(m.db, m.user.id, id, 4);
    expect(onDay.error).toBeNull();
  });

  it("refuses a tick on an upcoming challenge's first day before it starts", async () => {
    const id = await seedChallenge({ p_start: sofiaDay(2) });
    const m = await member("tick-upcoming");
    expect((await m.db.rpc("join_challenge", { p_id: id })).error).toBeNull();
    const res = await tick(m.db, m.user.id, id, 1);
    expect(res.error?.message).toContain(MSG.window);
  });

  it("allows the first day of a challenge that starts today", async () => {
    const id = await seedChallenge({ p_start: sofiaDay(0) });
    const m = await member("tick-today-start");
    expect((await m.db.rpc("join_challenge", { p_id: id })).error).toBeNull();
    expect((await tick(m.db, m.user.id, id, 1)).error).toBeNull();
  });

  it("refuses a non-participant and ticking for someone else", async () => {
    const { id, user } = await setup("tick-owner");
    const stranger = await member("tick-stranger");
    const noPart = await tick(stranger.db, stranger.user.id, id, 4);
    expect(noPart.error).not.toBeNull();
    const forOther = await tick(stranger.db, user.id, id, 4);
    expect(forOther.error).not.toBeNull();
    const rows = await admin.from("challenge_ticks").select("user_id").eq("challenge_id", id);
    expect(rows.data ?? []).toEqual([]);
  });

  it("refuses a member whose access has lapsed, but keeps her earlier ticks", async () => {
    const { id, user, db } = await setup("tick-lapse");
    expect((await tick(db, user.id, id, 4)).error).toBeNull();
    await grantAccess(admin, user.id, "canceled");

    const res = await tick(db, user.id, id, 3);
    expect(res.error?.message).toContain(MSG.access);
    const untick = await db
      .from("challenge_ticks")
      .delete()
      .eq("challenge_id", id)
      .eq("day", 4)
      .select("day");
    expect(untick.error?.message).toContain(MSG.access);
    const rows = await admin.from("challenge_ticks").select("day").eq("challenge_id", id);
    expect(rows.data).toEqual([{ day: 4 }]);
  });

  it("untick works for today and yesterday, refused outside the window", async () => {
    const { id, user, db } = await setup("tick-untick");
    await tick(db, user.id, id, 4);
    await tick(db, user.id, id, 3);
    const del = await db
      .from("challenge_ticks")
      .delete()
      .eq("challenge_id", id)
      .eq("day", 3)
      .select("day");
    expect(del.error).toBeNull();
    expect(del.data).toEqual([{ day: 3 }]);

    // A tick that is now older than yesterday (planted past the guard) can no longer be removed.
    psql(
      `set local session_replication_role = replica; insert into public.challenge_ticks (challenge_id, user_id, day) values ('${id}', '${user.id}', 1)`,
    );
    const old = await db
      .from("challenge_ticks")
      .delete()
      .eq("challenge_id", id)
      .eq("day", 1)
      .select("day");
    expect(old.error?.message).toContain(MSG.window);
    const left = await admin
      .from("challenge_ticks")
      .select("day")
      .eq("challenge_id", id)
      .order("day");
    expect(left.data).toEqual([{ day: 1 }, { day: 4 }]);
  });

  it("members cannot move ticks or set ticked_at", async () => {
    const { id, user, db } = await setup("tick-cols");
    const ins = await db
      .from("challenge_ticks")
      .insert({ challenge_id: id, user_id: user.id, day: 4, ticked_at: "2026-01-01T00:00:00Z" });
    expect(ins.error).not.toBeNull();
    await tick(db, user.id, id, 4);
    const upd = await db.from("challenge_ticks").update({ day: 3 }).eq("challenge_id", id);
    expect(upd.error).not.toBeNull();
    const rows = await admin.from("challenge_ticks").select("day").eq("challenge_id", id);
    expect(rows.data).toEqual([{ day: 4 }]);
  });

  it("a duplicate tick for the same day is refused by the key", async () => {
    const { id, user, db } = await setup("tick-dup");
    expect((await tick(db, user.id, id, 4)).error).toBeNull();
    expect((await tick(db, user.id, id, 4)).error).not.toBeNull();
  });
});

describe("challenge points", () => {
  it("awards 5 points once per day, however often she unticks and ticks again", async () => {
    const id = await seedChallenge();
    const m = await member("pts-once");
    await seedParticipant(id, m.user.id, sofiaDay(-3));

    expect((await tick(m.db, m.user.id, id, 4)).error).toBeNull();
    expect(await ledger(m.user.id)).toEqual([{ source: "challenge", ref: `${id}:4`, points: 5 }]);

    await m.db.from("challenge_ticks").delete().eq("challenge_id", id).eq("day", 4);
    expect(await ledger(m.user.id)).toHaveLength(1);

    expect((await tick(m.db, m.user.id, id, 4)).error).toBeNull();
    expect(await ledger(m.user.id)).toHaveLength(1);

    expect((await tick(m.db, m.user.id, id, 3)).error).toBeNull();
    expect(await ledger(m.user.id)).toEqual([
      { source: "challenge", ref: `${id}:3`, points: 5 },
      { source: "challenge", ref: `${id}:4`, points: 5 },
    ]);
    const total = await m.db.rpc("member_points", { uid: m.user.id });
    expect(total.data).toEqual([{ points: 10, level: 1 }]);
  });

  it("a refused tick earns nothing", async () => {
    const id = await seedChallenge();
    const m = await member("pts-refused");
    await seedParticipant(id, m.user.id, sofiaDay(-3));
    await tick(m.db, m.user.id, id, 1);
    expect(await ledger(m.user.id)).toEqual([]);
  });
});

describe("locks", () => {
  it("start date and day count are fixed once someone has joined; text and publishing are not", async () => {
    const id = await seedChallenge({ p_days: 5 });
    const m = await member("lock-fixed");
    expect((await m.db.rpc("join_challenge", { p_id: id })).error).toBeNull();

    const start = await save(boss, { p_id: id, p_days: 5, p_start: sofiaDay(-2) });
    expect(start.error?.message).toContain(MSG.startLock);
    const days = await save(boss, { p_id: id, p_days: 6, p_tasks: tasks(6) });
    expect(days.error?.message).toContain(MSG.startLock);

    const edit = await save(boss, {
      p_id: id,
      p_days: 5,
      p_title: "Преименувано",
      p_description: "Нов текст",
      p_published: false,
      p_tasks: tasks(5, [{ task: "Нова задача" }]),
    });
    expect(edit.error).toBeNull();
    const row = await admin
      .from("challenges")
      .select("title, published, start_date, days")
      .eq("id", id)
      .single();
    expect(row.data).toEqual({
      title: "Преименувано",
      published: false,
      start_date: sofiaDay(-3),
      days: 5,
    });
    const day1 = await admin
      .from("challenge_days")
      .select("task")
      .eq("challenge_id", id)
      .eq("day", 1)
      .single();
    expect(day1.data?.task).toBe("Нова задача");
  });

  it("the database refuses a direct change of start or days with participants, too", async () => {
    const id = await seedChallenge({ p_days: 5 });
    const m = await member("lock-direct");
    await seedParticipant(id, m.user.id, sofiaDay(-3));
    const res = await admin.from("challenges").update({ days: 6 }).eq("id", id);
    expect(res.error?.message).toContain(MSG.startLock);
    const res2 = await admin
      .from("challenges")
      .update({ start_date: sofiaDay(-1) })
      .eq("id", id);
    expect(res2.error?.message).toContain(MSG.startLock);
    const ok = await admin.from("challenges").update({ description: "ок" }).eq("id", id);
    expect(ok.error).toBeNull();
  });

  it("start and days stay editable while nobody has joined", async () => {
    const id = await seedChallenge({ p_days: 5 });
    const res = await save(boss, { p_id: id, p_days: 6, p_start: sofiaDay(-1), p_tasks: tasks(6) });
    expect(res.error).toBeNull();
    const row = await admin.from("challenges").select("days, start_date").eq("id", id).single();
    expect(row.data).toEqual({ days: 6, start_date: sofiaDay(-1) });
    const days = await admin.from("challenge_days").select("day").eq("challenge_id", id);
    expect(days.data).toHaveLength(6);
  });
});

describe("admin_delete_challenge", () => {
  it("deletes a challenge without participants (days go with it)", async () => {
    const id = await seedChallenge({ p_days: 3 });
    const res = await boss.rpc("admin_delete_challenge", { p_id: id });
    expect(res.error).toBeNull();
    const row = await admin.from("challenges").select("id").eq("id", id);
    expect(row.data ?? []).toEqual([]);
    const days = await admin.from("challenge_days").select("day").eq("challenge_id", id);
    expect(days.data ?? []).toEqual([]);
  });

  it("is refused once someone has joined, by the function and by the database", async () => {
    const id = await seedChallenge({ p_days: 3 });
    const m = await member("del-lock");
    await seedParticipant(id, m.user.id, sofiaDay(-3));
    const res = await boss.rpc("admin_delete_challenge", { p_id: id });
    expect(res.error?.message).toContain(MSG.deleteLock);
    const direct = await admin.from("challenges").delete().eq("id", id);
    expect(direct.error?.message).toContain(MSG.deleteLock);
    const row = await admin.from("challenges").select("id").eq("id", id);
    expect(row.data).toHaveLength(1);
  });

  it("is refused for members and anonymous callers, and for a missing challenge", async () => {
    const id = await seedChallenge({ p_days: 3 });
    const m = await member("del-member");
    expect((await m.db.rpc("admin_delete_challenge", { p_id: id })).error).not.toBeNull();
    expect((await anonClient().rpc("admin_delete_challenge", { p_id: id })).error).not.toBeNull();
    expect(
      (await boss.rpc("admin_delete_challenge", { p_id: crypto.randomUUID() })).error,
    ).not.toBeNull();
    const row = await admin.from("challenges").select("id").eq("id", id);
    expect(row.data).toHaveLength(1);
  });
});

describe("show_on_board", () => {
  it("a member changes only her own flag", async () => {
    const id = await seedChallenge({ p_days: 3 });
    const a = await member("show-a");
    const b = await member("show-b");
    await seedParticipant(id, a.user.id, sofiaDay(-3));
    await seedParticipant(id, b.user.id, sofiaDay(-3));

    const own = await a.db
      .from("challenge_participants")
      .update({ show_on_board: false })
      .eq("challenge_id", id)
      .eq("user_id", a.user.id)
      .select("show_on_board");
    expect(own.data).toEqual([{ show_on_board: false }]);

    const theirs = await a.db
      .from("challenge_participants")
      .update({ show_on_board: false })
      .eq("challenge_id", id)
      .eq("user_id", b.user.id)
      .select("show_on_board");
    expect(theirs.data ?? []).toEqual([]);
    const moved = await a.db
      .from("challenge_participants")
      .update({ joined_on: sofiaDay(-1) })
      .eq("challenge_id", id)
      .eq("user_id", a.user.id);
    expect(moved.error).not.toBeNull();
    const row = await admin
      .from("challenge_participants")
      .select("show_on_board")
      .eq("user_id", b.user.id)
      .single();
    expect(row.data?.show_on_board).toBe(true);
  });
});

describe("challenge_board", () => {
  /** Yesterday = day 1, today = day 2. */
  async function boardChallenge() {
    return seedChallenge({ p_start: sofiaDay(-1), p_days: 5 });
  }

  async function board(db: TypedClient, id: string) {
    const res = await db.rpc("challenge_board", { p_id: id });
    if (res.error) throw res.error;
    return res.data!;
  }

  it("orders by ticks, then by who reached that count first", async () => {
    const id = await boardChallenge();
    const [a, b, c] = await Promise.all([
      member("board-a", { name: "Анна Атанасова" }),
      member("board-b", { name: "Борис Борисов" }),
      member("board-c", { name: "Цвета Цветкова" }),
    ]);
    for (const m of [a, b, c]) await seedParticipant(id, m.user.id, sofiaDay(-1));
    await seedTick(id, b.user.id, 1);
    await seedTick(id, a.user.id, 1);
    await seedTick(id, a.user.id, 2);
    await seedTick(id, b.user.id, 2);
    await seedTick(id, c.user.id, 1);

    const rows = await board(a.db, id);
    expect(rows).toEqual([
      { rank: 1, display_name: "Анна А.", ticked: 2, is_me: true },
      { rank: 2, display_name: "Борис Б.", ticked: 2, is_me: false },
      { rank: 3, display_name: "Цвета Ц.", ticked: 1, is_me: false },
    ]);
    const asB = await board(b.db, id);
    expect(asB.map((r) => r.is_me)).toEqual([false, true, false]);
  });

  it("formats names: first word + upper-cased initial of the second; 'Участничка' for one word, empty or email/digit-shaped names", async () => {
    const id = await boardChallenge();
    const names = [
      "Мария Петрова",
      "Елена",
      "",
      "Йоана Ивана Георгиева",
      "  Дара   Стоянова  ",
      "мария петрова",
      "ivana@mail.bg",
      "ivana@mail.bg Петрова",
      "User42 Тодорова",
    ];
    // Sequential: nine parallel sign-ins time out the local auth service.
    const members: Awaited<ReturnType<typeof member>>[] = [];
    for (const [i, n] of names.entries())
      members.push(await member(`board-name-${i}`, { name: n }));
    for (const m of members) await seedParticipant(id, m.user.id, sofiaDay(-1));
    // Distinct counts keep the order deterministic.
    await seedTick(id, members[0]!.user.id, 1);
    await seedTick(id, members[0]!.user.id, 2);
    await seedTick(id, members[1]!.user.id, 1);
    await seedTick(id, members[2]!.user.id, 2);
    await seedTick(id, members[3]!.user.id, 1);
    await seedTick(id, members[4]!.user.id, 2);
    await seedTick(id, members[5]!.user.id, 1);
    await seedTick(id, members[6]!.user.id, 1);
    await seedTick(id, members[7]!.user.id, 1);
    await seedTick(id, members[8]!.user.id, 1);

    const rows = await board(members[0]!.db, id);
    const byTicks = rows.map((r) => r.display_name);
    expect(byTicks[0]).toBe("Мария П.");
    expect(byTicks.filter((n) => n === "Участничка")).toHaveLength(5); // "", "Елена", and the three email/digit names
    expect(byTicks).toEqual(expect.arrayContaining(["Йоана И.", "Дара С.", "мария П."]));
    expect(byTicks).not.toContain("Елена");
    expect(rows).toHaveLength(9);
    for (const r of rows) {
      expect(r.display_name).not.toContain("Петрова");
      expect(r.display_name).not.toContain("Георгиева");
      expect(r.display_name).not.toContain("@");
    }
  });

  it("shows 'Участничка' for a member who opted out, but she still ranks", async () => {
    const id = await boardChallenge();
    const hidden = await member("board-hidden", { name: "Невена Николова" });
    const shown = await member("board-shown", { name: "Радка Русева" });
    await seedParticipant(id, hidden.user.id, sofiaDay(-1));
    await seedParticipant(id, shown.user.id, sofiaDay(-1));
    await seedTick(id, hidden.user.id, 1);
    await seedTick(id, hidden.user.id, 2);
    await seedTick(id, shown.user.id, 1);
    expect(
      (
        await hidden.db
          .from("challenge_participants")
          .update({ show_on_board: false })
          .eq("challenge_id", id)
          .eq("user_id", hidden.user.id)
      ).error,
    ).toBeNull();

    const rows = await board(shown.db, id);
    expect(rows).toEqual([
      { rank: 1, display_name: "Участничка", ticked: 2, is_me: false },
      { rank: 2, display_name: "Радка Р.", ticked: 1, is_me: true },
    ]);
    const own = await board(hidden.db, id);
    expect(own[0]).toEqual({ rank: 1, display_name: "Участничка", ticked: 2, is_me: true });
  });

  it("returns the top 10 plus her own row when she is lower", async () => {
    const id = await boardChallenge();
    const others = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        member(`board-top-${i}`, { name: `Участник${i} Тестов` }),
      ),
    );
    const me = await member("board-me", { name: "Моя Позиция" });
    for (const m of others) {
      await seedParticipant(id, m.user.id, sofiaDay(-1));
      await seedTick(id, m.user.id, 2);
    }
    await seedParticipant(id, me.user.id, sofiaDay(-1));

    const rows = await board(me.db, id);
    expect(rows).toHaveLength(11);
    expect(rows.slice(0, 10).every((r) => !r.is_me && r.ticked === 1)).toBe(true);
    expect(rows[10]).toEqual({ rank: 11, display_name: "Моя П.", ticked: 0, is_me: true });
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    const top = await board(others[0]!.db, id);
    expect(top).toHaveLength(10);
    expect(top.filter((r) => r.is_me)).toHaveLength(1);
  });

  it("keeps a member whose access has lapsed on the board and lets her read it", async () => {
    const id = await boardChallenge();
    const m = await member("board-lapse", { name: "Лидия Лазарова" });
    await seedParticipant(id, m.user.id, sofiaDay(-1));
    await seedTick(id, m.user.id, 2);
    await grantAccess(admin, m.user.id, "canceled");
    const rows = await board(m.db, id);
    expect(rows).toEqual([{ rank: 1, display_name: "Лидия Л.", ticked: 1, is_me: true }]);
  });

  it("is readable by members with access for published challenges and by admins, not otherwise", async () => {
    const id = await boardChallenge();
    const hidden = await seedChallenge({ p_start: sofiaDay(-1), p_days: 5, p_published: false });
    const viewer = await member("board-viewer");
    const lapsed = await member("board-nolook", { access: false });
    const part = await member("board-part");
    await seedParticipant(hidden, part.user.id, sofiaDay(-1));

    expect((await viewer.db.rpc("challenge_board", { p_id: id })).error).toBeNull();
    expect((await boss.rpc("challenge_board", { p_id: id })).error).toBeNull();
    expect((await boss.rpc("challenge_board", { p_id: hidden })).error).toBeNull();
    expect((await viewer.db.rpc("challenge_board", { p_id: hidden })).error).not.toBeNull();
    expect((await lapsed.db.rpc("challenge_board", { p_id: id })).error).not.toBeNull();
    expect((await part.db.rpc("challenge_board", { p_id: hidden })).error).toBeNull();
    expect((await anonClient().rpc("challenge_board", { p_id: id })).error).not.toBeNull();

    const asViewer = await board(viewer.db, id);
    expect(asViewer.some((r) => r.is_me)).toBe(false);
  });
});

describe("challenge_counts", () => {
  it("counts participants of the challenges the caller may see", async () => {
    const a = await seedChallenge({ p_days: 3 });
    const b = await seedChallenge({ p_days: 3 });
    const hidden = await seedChallenge({ p_days: 3, p_published: false });
    const m1 = await member("count-1");
    const m2 = await member("count-2");
    await seedParticipant(a, m1.user.id, sofiaDay(-3));
    await seedParticipant(a, m2.user.id, sofiaDay(-3));
    await seedParticipant(hidden, m2.user.id, sofiaDay(-3));

    const res = await m1.db.rpc("challenge_counts", { p_ids: [a, b, hidden] });
    expect(res.error).toBeNull();
    const byId = Object.fromEntries(res.data!.map((r) => [r.challenge_id, r.participants]));
    expect(byId[a]).toBe(2);
    expect(byId[b]).toBe(0);
    expect(byId[hidden]).toBeUndefined();

    const asBoss = await boss.rpc("challenge_counts", { p_ids: [hidden] });
    expect(asBoss.data).toEqual([{ challenge_id: hidden, participants: 1 }]);

    const lapsed = await member("count-lapsed", { access: false });
    const none = await lapsed.db.rpc("challenge_counts", { p_ids: [a, b] });
    expect(none.data ?? []).toEqual([]);

    expect((await anonClient().rpc("challenge_counts", { p_ids: [a] })).error).not.toBeNull();
  });
});

describe("cascades", () => {
  it("deleting a member removes her participation and ticks", async () => {
    const id = await seedChallenge();
    const m = await member("cascade-user");
    await seedParticipant(id, m.user.id, sofiaDay(-3));
    await seedTick(id, m.user.id, 4);

    const del = await admin.auth.admin.deleteUser(m.user.id);
    expect(del.error).toBeNull();
    const parts = await admin
      .from("challenge_participants")
      .select("user_id")
      .eq("user_id", m.user.id);
    const ticks = await admin.from("challenge_ticks").select("user_id").eq("user_id", m.user.id);
    expect(parts.data ?? []).toEqual([]);
    expect(ticks.data ?? []).toEqual([]);
    const row = await admin.from("challenges").select("id").eq("id", id);
    expect(row.data).toHaveLength(1);
  });

  it("deleting a workout only clears it from the days", async () => {
    const wid = await createWorkout(admin, {
      title: "Тренировка за каскада",
      duration_min: 20,
      kind: "regular",
      level: "beginner",
      publish_at: new Date(Date.now() - 3600_000).toISOString(),
    });
    const id = await seedChallenge({ p_days: 3, p_tasks: tasks(3, [{ workoutId: wid }]) });
    await admin.from("workouts").delete().eq("id", wid);
    const day = await admin
      .from("challenge_days")
      .select("workout_id")
      .eq("challenge_id", id)
      .eq("day", 1)
      .single();
    expect(day.data?.workout_id).toBeNull();
  });
});

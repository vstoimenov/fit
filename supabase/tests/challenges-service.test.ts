import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isAppError } from "@/lib/app-error";
import { sofiaToday } from "@/lib/progress-photos/today";
import {
  getChallengeView,
  homeChallenge,
  joinChallenge,
  listMemberChallenges,
  setBoardVisibility,
  setTick,
} from "@/server/challenges/challenges";
import {
  adminClient,
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
const createdChallenges: string[] = [];
const createdWorkouts: string[] = [];
const createdUsers: string[] = [];
const today = sofiaToday();

function sofiaDay(offsetDays = 0): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const MSG = {
  access: "Нужен е активен абонамент.",
  window: "Може да отметнеш само днес и вчера.",
  beforeJoin: "Този ден е преди да се включиш.",
  ended: "Предизвикателството вече приключи.",
};

type Task = { task: string; workoutId?: string | null };

function tasks(n: number, over: Partial<Task>[] = []): Task[] {
  return Array.from({ length: n }, (_, i) => ({
    task: `Задача ${i + 1}`,
    workoutId: null,
    ...over[i],
  }));
}

interface Opts {
  title?: string;
  start?: number;
  days?: number;
  published?: boolean;
  tasks?: Task[];
}

/** By default: published, started 3 days ago (today is day 4), 10 days. */
async function seedChallenge(o: Opts = {}): Promise<string> {
  const days = o.days ?? 10;
  const res = await boss.rpc("admin_save_challenge", {
    p_id: null,
    p_title: o.title ?? "Тестово предизвикателство",
    p_description: "Описание",
    p_start: sofiaDay(o.start ?? -3),
    p_days: days,
    p_published: o.published ?? true,
    p_tasks: o.tasks ?? tasks(days),
  } as never);
  if (res.error || !res.data) throw res.error ?? new Error("seed challenge failed");
  const id = res.data as unknown as string;
  createdChallenges.push(id);
  return id;
}

async function member(
  label: string,
  opts: { access?: boolean; name?: string } = {},
): Promise<{ user: TestUser; db: TypedClient }> {
  const user = await createUser(admin, label);
  createdUsers.push(user.id);
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

/** Superuser SQL against the local stack only: plants a tick on a day the guard would refuse (too old). */
function plantTick(challengeId: string, userId: string, day: number): void {
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_fit-platform",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `set session_replication_role = replica; insert into public.challenge_ticks (challenge_id, user_id, day) values ('${challengeId}', '${userId}', ${day})`,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "/tmp/dockercfg" },
    },
  );
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("expected an AppError");
}

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "chal-svc-admin")).db;
});

afterAll(async () => {
  // Only what this file created: participants first (the lock guard refuses deleting a joined challenge).
  if (createdChallenges.length) {
    await admin.from("challenge_participants").delete().in("challenge_id", createdChallenges);
    await admin.from("challenges").delete().in("id", createdChallenges);
  }
  if (createdWorkouts.length) await admin.from("workouts").delete().in("id", createdWorkouts);
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
});

describe("listMemberChallenges", () => {
  it("groups running, upcoming and joined finished; hides unpublished and unjoined ended ones", async () => {
    const running = await seedChallenge({ title: "Тече", start: -2 });
    const upcoming = await seedChallenge({ title: "Предстои", start: 3, days: 5 });
    const endedJoined = await seedChallenge({ title: "Свършило мое", start: -8, days: 5 });
    const endedOther = await seedChallenge({ title: "Свършило чуждо", start: -8, days: 5 });
    const draft = await seedChallenge({ title: "Чернова", published: false });
    const { user, db } = await member("chal-list");
    await seedParticipant(endedJoined, user.id, sofiaDay(-8));
    plantTick(endedJoined, user.id, 1);

    const list = await listMemberChallenges(db, user.id, today);
    const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
    expect(ids(list.running)).toContain(running);
    expect(ids(list.upcoming)).toContain(upcoming);
    expect(ids(list.joinedFinished)).toContain(endedJoined);
    const all = [...ids(list.running), ...ids(list.upcoming), ...ids(list.joinedFinished)];
    expect(all).not.toContain(endedOther);
    expect(all).not.toContain(draft);

    const r = list.running.find((c) => c.id === running);
    expect(r).toMatchObject({
      status: "running",
      day: 3,
      days: 10,
      joined: false,
      progress: null,
      participants: 0,
    });
    expect(list.upcoming.find((c) => c.id === upcoming)).toMatchObject({
      status: "upcoming",
      day: null,
      startDate: sofiaDay(3),
      endDate: sofiaDay(7),
    });
    expect(list.joinedFinished.find((c) => c.id === endedJoined)).toMatchObject({
      status: "ended",
      joined: true,
      progress: { done: 1, total: 5, finished: false },
      participants: 1,
    });
  });

  it("shows her progress and the participant count on a running challenge she joined", async () => {
    const id = await seedChallenge({ title: "Моето", start: -2 });
    const a = await member("chal-list-a");
    const b = await member("chal-list-b");
    await seedParticipant(id, a.user.id, sofiaDay(-2));
    await seedParticipant(id, b.user.id, sofiaDay(-1));
    await seedTick(id, a.user.id, 2);
    await seedTick(id, a.user.id, 3);

    const list = await listMemberChallenges(a.db, a.user.id, today);
    expect(list.running.find((c) => c.id === id)).toMatchObject({
      joined: true,
      participants: 2,
      progress: { done: 2, total: 10, finished: false },
    });
  });

  it("keeps an unpublished challenge she joined, and hides published ones from a lapsed member", async () => {
    const id = await seedChallenge({ title: "Скрито после", start: -2 });
    const open = await seedChallenge({ title: "Видимо", start: -2 });
    const joined = await member("chal-list-unpub");
    await seedParticipant(id, joined.user.id, sofiaDay(-2));
    await boss.rpc("admin_save_challenge", {
      p_id: id,
      p_title: "Скрито после",
      p_description: "",
      p_start: sofiaDay(-2),
      p_days: 10,
      p_published: false,
      p_tasks: tasks(10),
    } as never);
    expect(
      (await listMemberChallenges(joined.db, joined.user.id, today)).running.map((c) => c.id),
    ).toContain(id);

    const lapsed = await member("chal-list-lapsed", { access: false });
    const none = await listMemberChallenges(lapsed.db, lapsed.user.id, today);
    expect([...none.running, ...none.upcoming].map((c) => c.id)).not.toContain(open);
  });
});

describe("getChallengeView", () => {
  it("marks days before a late joiner's first day and counts progress from it", async () => {
    // Started 5 days ago: today is day 6 of 10.
    const id = await seedChallenge({ start: -5 });
    const { user, db } = await member("chal-late");
    await joinChallenge(db, id);

    const view = await getChallengeView(db, user.id, id, today);
    if (!view) throw new Error("view is null");
    expect(view.hasAccess).toBe(true);
    expect(view.challenge).toMatchObject({ id, status: "running", day: 6, days: 10 });
    expect(view.participation).toMatchObject({ joinedOn: today, firstDay: 6, showOnBoard: true });
    expect(view.progress).toEqual({ done: 0, total: 5, finished: false });

    const byDay = new Map(view.days.map((d) => [d.day, d]));
    expect(view.days).toHaveLength(10);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(byDay.get(n)).toMatchObject({ beforeJoin: true, tickable: false, locked: false });
    }
    expect(byDay.get(6)).toMatchObject({ beforeJoin: false, tickable: true, locked: false });
    for (const n of [7, 8, 9, 10]) {
      expect(byDay.get(n)).toMatchObject({ beforeJoin: false, tickable: false, locked: true });
    }
    expect(byDay.get(6)?.date).toBe(today);
  });

  it("flags today and yesterday tickable, done days, and locks the future", async () => {
    // Started 3 days ago: today is day 4.
    const id = await seedChallenge({ start: -3 });
    const { user, db } = await member("chal-flags");
    await seedParticipant(id, user.id, sofiaDay(-3));
    await seedTick(id, user.id, 3);

    const view = await getChallengeView(db, user.id, id, today);
    if (!view) throw new Error("view is null");
    const d = (n: number) => view.days.find((x) => x.day === n);
    expect(d(1)).toMatchObject({ tickable: false, locked: false, done: false, beforeJoin: false });
    expect(d(2)).toMatchObject({ tickable: false, locked: false });
    expect(d(3)).toMatchObject({ tickable: true, done: true });
    expect(d(4)).toMatchObject({ tickable: true, done: false, locked: false });
    expect(d(5)).toMatchObject({ tickable: false, locked: true });
    expect(view.progress).toEqual({ done: 1, total: 10, finished: false });
  });

  it("shows a preview with nothing tickable to someone who has not joined", async () => {
    const id = await seedChallenge({ start: -1 });
    const { user, db } = await member("chal-preview");
    const view = await getChallengeView(db, user.id, id, today);
    if (!view) throw new Error("view is null");
    expect(view.participation).toBeNull();
    expect(view.progress).toBeNull();
    expect(view.days.every((x) => !x.tickable && !x.done && !x.beforeJoin)).toBe(true);
    expect(view.days.find((x) => x.day === 3)?.locked).toBe(true);
  });

  it("is read-only once her access has lapsed", async () => {
    const id = await seedChallenge({ start: -3 });
    const { user, db } = await member("chal-lapsed");
    await seedParticipant(id, user.id, sofiaDay(-3));
    await seedTick(id, user.id, 3);
    await grantAccess(admin, user.id, "canceled");

    const view = await getChallengeView(db, user.id, id, today);
    if (!view) throw new Error("view is null");
    expect(view.hasAccess).toBe(false);
    expect(view.days.some((x) => x.tickable)).toBe(false);
    expect(view.days.find((x) => x.day === 3)?.done).toBe(true);
    expect(view.progress).toEqual({ done: 1, total: 10, finished: false });
    expect(await homeChallenge(db, user.id, today)).toMatchObject({ tickable: false });

    const err = await refusal(setTick(db, user.id, { id, day: 4, done: true }));
    expect(err.userMessage).toBe(MSG.access);
    const untick = await refusal(setTick(db, user.id, { id, day: 3, done: false }));
    expect(untick.userMessage).toBe(MSG.access);
  });

  it("is null for an unknown id, an unpublished challenge she is not in, and a lapsed outsider", async () => {
    const draft = await seedChallenge({ published: false });
    const open = await seedChallenge({});
    const { user, db } = await member("chal-invisible");
    expect(await getChallengeView(db, user.id, draft, today)).toBeNull();
    expect(
      await getChallengeView(db, user.id, "6f1c0c0e-0000-4000-8000-000000000000", today),
    ).toBeNull();
    const lapsed = await member("chal-invisible-lapsed", { access: false });
    expect(await getChallengeView(lapsed.db, lapsed.user.id, open, today)).toBeNull();
  });

  it("links the day's workout and reports whether she did it today", async () => {
    const workout = await createWorkout(admin, {
      title: "Тренировка за ден",
      duration_min: 20,
      kind: "regular",
      level: "beginner",
      publish_at: new Date(Date.now() - 3600_000).toISOString(),
    });
    createdWorkouts.push(workout);
    const id = await seedChallenge({
      start: -3,
      tasks: tasks(10, [{}, {}, {}, { workoutId: workout }]),
    });
    const { user, db } = await member("chal-workout");
    await seedParticipant(id, user.id, sofiaDay(-3));

    let view = await getChallengeView(db, user.id, id, today);
    expect(view?.days.find((x) => x.day === 4)).toMatchObject({
      workout: { id: workout, title: "Тренировка за ден" },
      workoutDoneToday: false,
    });
    expect(view?.days.find((x) => x.day === 3)?.workout).toBeNull();

    const done = await db.from("workout_completions").insert({ workout_id: workout });
    expect(done.error).toBeNull();
    view = await getChallengeView(db, user.id, id, today);
    expect(view?.days.find((x) => x.day === 4)?.workoutDoneToday).toBe(true);
    expect(view?.days.find((x) => x.day === 3)?.workoutDoneToday).toBe(false);
  });

  it("flags the workout hint only on the day whose date is today", async () => {
    const workout = await createWorkout(admin, {
      title: "Повторена тренировка",
      duration_min: 20,
      kind: "regular",
      level: "beginner",
      publish_at: new Date(Date.now() - 3600_000).toISOString(),
    });
    createdWorkouts.push(workout);
    // Today is day 4; the same workout is on days 2 (past), 4 (today) and 7 (future).
    const id = await seedChallenge({
      start: -3,
      tasks: tasks(10, [
        {},
        { workoutId: workout },
        {},
        { workoutId: workout },
        {},
        {},
        { workoutId: workout },
      ]),
    });
    const { user, db } = await member("chal-workout-once");
    await seedParticipant(id, user.id, sofiaDay(-3));
    expect((await db.from("workout_completions").insert({ workout_id: workout })).error).toBeNull();

    const view = await getChallengeView(db, user.id, id, today);
    const flagged = view?.days.filter((x) => x.workoutDoneToday).map((x) => x.day);
    expect(flagged).toEqual([4]);
    expect(view?.days.filter((x) => x.workout).map((x) => x.day)).toEqual([2, 4, 7]);
  });

  it("returns the leaderboard with her own row marked", async () => {
    const id = await seedChallenge({ start: -3 });
    const a = await member("chal-board-a", { name: "Мария Петрова" });
    const b = await member("chal-board-b", { name: "Яна Иванова" });
    await seedParticipant(id, a.user.id, sofiaDay(-3));
    await seedParticipant(id, b.user.id, sofiaDay(-3));
    await seedTick(id, b.user.id, 3);
    await seedTick(id, b.user.id, 4);
    await seedTick(id, a.user.id, 4);

    const view = await getChallengeView(a.db, a.user.id, id, today);
    expect(view?.board).toEqual([
      { rank: 1, name: "Яна И.", ticked: 2, isMe: false },
      { rank: 2, name: "Мария П.", ticked: 1, isMe: true },
    ]);
    expect(view?.challenge.participants).toBe(2);
  });
});

describe("homeChallenge", () => {
  it("is null when she is in no running challenge", async () => {
    const { user, db } = await member("chal-home-none");
    const upcoming = await seedChallenge({ start: 2, days: 4 });
    await joinChallenge(db, upcoming);
    expect(await homeChallenge(db, user.id, today)).toBeNull();
  });

  it("picks the running challenge that ends first and counts the others", async () => {
    const lateEnd = await seedChallenge({ title: "Дълго", start: -2, days: 20 });
    const early = await seedChallenge({
      title: "Кратко",
      start: -2,
      days: 5,
      tasks: tasks(5, [{}, {}, { task: "Днешната задача" }]),
    });
    const { user, db } = await member("chal-home");
    await seedParticipant(lateEnd, user.id, sofiaDay(-2));
    await seedParticipant(early, user.id, sofiaDay(-2));

    const home = await homeChallenge(db, user.id, today);
    expect(home).toMatchObject({
      challenge: { id: early, title: "Кратко", days: 5 },
      day: 3,
      task: "Днешната задача",
      tickable: true,
      done: false,
      more: 1,
    });

    await seedTick(early, user.id, 3);
    expect(await homeChallenge(db, user.id, today)).toMatchObject({ done: true, more: 1 });
  });

  it("ignores finished challenges and ones she did not join", async () => {
    const ended = await seedChallenge({ start: -8, days: 5 });
    const notJoined = await seedChallenge({ start: -1 });
    const { user, db } = await member("chal-home-ignore");
    await seedParticipant(ended, user.id, sofiaDay(-8));
    // It is listed for her (published, running) but is not on the home card because she is not in it.
    const list = await listMemberChallenges(db, user.id, today);
    expect(list.running.map((c) => c.id)).toContain(notJoined);
    expect(await homeChallenge(db, user.id, today)).toBeNull();
  });
});

describe("joinChallenge, setTick and setBoardVisibility", () => {
  it("joins, ticks, unticks and earns the points once", async () => {
    const id = await seedChallenge({ start: -3 });
    const { user, db } = await member("chal-flow");
    await joinChallenge(db, id);
    await joinChallenge(db, id); // idempotent

    await setTick(db, user.id, { id, day: 4, done: true });
    await setTick(db, user.id, { id, day: 4, done: true }); // a retried tap is not an error
    let view = await getChallengeView(db, user.id, id, today);
    expect(view?.days.find((x) => x.day === 4)?.done).toBe(true);
    expect(view?.progress).toEqual({ done: 1, total: 7, finished: false });

    await setTick(db, user.id, { id, day: 4, done: false });
    view = await getChallengeView(db, user.id, id, today);
    expect(view?.days.find((x) => x.day === 4)?.done).toBe(false);

    await setTick(db, user.id, { id, day: 4, done: true });
    const { data } = await admin
      .from("points_ledger")
      .select("points")
      .eq("user_id", user.id)
      .eq("source", "challenge")
      .eq("ref", `${id}:4`);
    expect(data).toEqual([{ points: 5 }]);
  });

  it("reports points only for a tick that earned them", async () => {
    const id = await seedChallenge({ start: -3 });
    const { user, db } = await member("chal-points");
    await joinChallenge(db, id);

    expect(await setTick(db, user.id, { id, day: 4, done: true })).toEqual({ points: true });
    // The same day ticked again (another device, a retried tap): nothing new.
    expect(await setTick(db, user.id, { id, day: 4, done: true })).toEqual({ points: false });
    expect(await setTick(db, user.id, { id, day: 4, done: false })).toEqual({ points: false });
    // Ticked again after an untick: the points were taken the first time.
    expect(await setTick(db, user.id, { id, day: 4, done: true })).toEqual({ points: false });
    // Another challenge's day is a first tick of its own.
    const other = await seedChallenge({ start: -3 });
    await joinChallenge(db, other);
    expect(await setTick(db, user.id, { id: other, day: 4, done: true })).toEqual({ points: true });
  });

  it("explains refusals in Bulgarian", async () => {
    const id = await seedChallenge({ start: -5 });
    const { user, db } = await member("chal-refuse");
    await joinChallenge(db, id); // first day 6
    expect((await refusal(setTick(db, user.id, { id, day: 5, done: true }))).userMessage).toBe(
      MSG.beforeJoin,
    );
    expect((await refusal(setTick(db, user.id, { id, day: 7, done: true }))).userMessage).toBe(
      MSG.window,
    );
    expect((await refusal(setTick(db, user.id, { id, day: 11, done: true }))).code).toBe("INVALID");

    const other = await member("chal-refuse-other");
    expect((await refusal(setTick(other.db, other.user.id, { id, day: 6, done: true }))).code).toBe(
      "INVALID",
    );

    const ended = await seedChallenge({ start: -8, days: 5 });
    expect((await refusal(joinChallenge(db, ended))).userMessage).toBe(MSG.ended);
    const lapsed = await member("chal-refuse-lapsed", { access: false });
    expect((await refusal(joinChallenge(lapsed.db, id))).userMessage).toBe(MSG.access);
    const draft = await seedChallenge({ published: false });
    expect((await refusal(joinChallenge(db, draft))).code).toBe("NOT_FOUND");
  });

  it("hides her name on the board when she opts out", async () => {
    const id = await seedChallenge({ start: -3 });
    const { user, db } = await member("chal-optout", { name: "Елена Костова" });
    await joinChallenge(db, id);
    await setBoardVisibility(db, user.id, { id, show: false });
    let view = await getChallengeView(db, user.id, id, today);
    expect(view?.participation?.showOnBoard).toBe(false);
    expect(view?.board).toEqual([{ rank: 1, name: "Участничка", ticked: 0, isMe: true }]);
    await setBoardVisibility(db, user.id, { id, show: true });
    view = await getChallengeView(db, user.id, id, today);
    expect(view?.board[0]).toMatchObject({ name: "Елена К." });
  });
});

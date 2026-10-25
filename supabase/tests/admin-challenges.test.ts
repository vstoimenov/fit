import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChallengeInput } from "@/lib/challenges/schema";
import {
  deleteChallenge,
  getChallenge,
  listChallenges,
  listPublishedWorkouts,
  saveChallenge,
} from "@/server/admin/challenges";
import {
  adminClient,
  createAdminUser,
  createUser,
  createWorkout,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const tag = `adm-chal-${Math.random().toString(36).slice(2, 8)}`;
const createdIds: string[] = [];
const createdWorkouts: string[] = [];

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

const input = (name: string, over: Partial<ChallengeInput> = {}): ChallengeInput => {
  const days = over.days ?? 5;
  return {
    title: `${tag} ${name}`,
    description: "Описание в **Markdown**.",
    startDate: sofiaDay(2),
    days,
    published: false,
    tasks: Array.from({ length: days }, (_, i) => ({ task: `Задача ${i + 1}`, workoutId: null })),
    ...over,
  };
};

async function create(name: string, over: Partial<ChallengeInput> = {}) {
  const id = await saveChallenge(boss, input(name, over));
  createdIds.push(id);
  return id;
}

async function workout(title: string, publishAt: string | null) {
  const id = await createWorkout(admin, {
    title: `${tag} ${title}`,
    duration_min: 20,
    kind: "regular",
    level: "beginner",
    publish_at: publishAt,
  });
  createdWorkouts.push(id);
  return id;
}

async function addParticipant(challengeId: string) {
  const user = await createUser(admin, "adm-chal-member");
  await grantAccess(admin, user.id);
  const { error } = await admin
    .from("challenge_participants")
    .insert({ challenge_id: challengeId, user_id: user.id, joined_on: sofiaDay(2) });
  if (error) throw error;
  return user;
}

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "adm-chal")).db;
});

afterAll(async () => {
  if (createdIds.length) {
    await admin.from("challenge_participants").delete().in("challenge_id", createdIds);
    await admin.from("challenges").delete().in("id", createdIds);
  }
  if (createdWorkouts.length) await admin.from("workouts").delete().in("id", createdWorkouts);
});

describe("admin challenges service", () => {
  it("creates a draft challenge and reads it back in camelCase with its day rows", async () => {
    const past = await workout("past", new Date(Date.now() - 3600_000).toISOString());
    const base = input("flow");
    const tasks = base.tasks.map((t, i) => (i === 1 ? { ...t, workoutId: past } : t));
    const id = await create("flow", { tasks });
    expect(await getChallenge(boss, id)).toEqual({
      ...base,
      tasks,
      id,
      hasParticipants: false,
      participants: 0,
    });
  });

  it("edits every field while nobody has joined, including start date and days", async () => {
    const id = await create("edit");
    const changed = input("edit", {
      title: `${tag} нов`,
      description: "",
      startDate: sofiaDay(10),
      days: 7,
      published: true,
    });
    expect(await saveChallenge(boss, { ...changed, id })).toBe(id);
    expect(await getChallenge(boss, id)).toMatchObject({ ...changed, id });
    const rows = await admin.from("challenge_days").select("day").eq("challenge_id", id);
    expect(rows.data).toHaveLength(7);
  });

  it("lists challenges with participant counts, newest start first", async () => {
    const older = await create("l-old", { startDate: sofiaDay(20) });
    const newer = await create("l-new", { startDate: sofiaDay(40) });
    await addParticipant(newer);
    await addParticipant(newer);
    const mine = (await listChallenges(boss)).filter((c) => [older, newer].includes(c.id));
    expect(mine.map((c) => c.id)).toEqual([newer, older]);
    expect(mine[0]).toMatchObject({
      title: `${tag} l-new`,
      startDate: sofiaDay(40),
      days: 5,
      published: false,
      participants: 2,
    });
    expect(mine[1].participants).toBe(0);
  });

  it("locks start date and days after someone joined, but texts and workouts stay editable", async () => {
    const id = await create("lock");
    await addParticipant(id);
    const loaded = await getChallenge(boss, id);
    expect(loaded).toMatchObject({ hasParticipants: true, participants: 1 });

    await expect(
      saveChallenge(boss, { ...input("lock"), id, startDate: sofiaDay(3) }),
    ).rejects.toMatchObject({
      code: "INVALID",
      userMessage: "Вече има участнички — началото и броят дни не се променят.",
    });
    const sixDays = input("lock", { days: 6 });
    await expect(saveChallenge(boss, { ...sixDays, id })).rejects.toMatchObject({
      code: "INVALID",
    });

    const edited = input("lock", { title: `${tag} lock2`, published: true });
    edited.tasks[0] = { task: "Нова задача", workoutId: null };
    await saveChallenge(boss, { ...edited, id });
    expect(await getChallenge(boss, id)).toMatchObject({
      title: `${tag} lock2`,
      published: true,
      tasks: edited.tasks,
    });
  });

  it("deletes a challenge without participants and refuses one that has them", async () => {
    const free = await create("del-free");
    await deleteChallenge(boss, free);
    expect(await getChallenge(boss, free)).toBeNull();

    const kept = await create("del-kept");
    await addParticipant(kept);
    await expect(deleteChallenge(boss, kept)).rejects.toMatchObject({
      code: "INVALID",
      userMessage: "Предизвикателство с участнички не може да се изтрие.",
    });
    expect(await getChallenge(boss, kept)).not.toBeNull();
  });

  it("passes the database's refusal of an unpublished workout through as INVALID", async () => {
    const future = await workout("future", new Date(Date.now() + 86_400_000).toISOString());
    const base = input("unpub");
    const tasks = base.tasks.map((t, i) => (i === 0 ? { ...t, workoutId: future } : t));
    await expect(saveChallenge(boss, { ...base, tasks })).rejects.toMatchObject({
      code: "INVALID",
      userMessage: "Ден 1: тренировката не е публикувана.",
    });
  });

  it("lists only workouts that are published now", async () => {
    const live = await workout("live", new Date(Date.now() - 3600_000).toISOString());
    const draft = await workout("draft", null);
    const future = await workout("later", new Date(Date.now() + 86_400_000).toISOString());
    const listed = await listPublishedWorkouts(boss);
    const ids = listed.map((w) => w.id);
    expect(ids).toContain(live);
    expect(ids).not.toContain(draft);
    expect(ids).not.toContain(future);
    expect(listed.find((w) => w.id === live)).toEqual({ id: live, title: `${tag} live` });
  });

  it("rejects input beyond the bounds before touching the database", async () => {
    await expect(saveChallenge(boss, input("bad", { days: 2 }))).rejects.toThrow();
    await expect(saveChallenge(boss, input("bad", { startDate: "2025-12-31" }))).rejects.toThrow();
    await expect(saveChallenge(boss, { ...input("bad"), tasks: [] })).rejects.toThrow();
  });

  it("reports a missing challenge", async () => {
    const missing = "00000000-0000-4000-8000-000000000000";
    expect(await getChallenge(boss, missing)).toBeNull();
    await expect(saveChallenge(boss, { ...input("none"), id: missing })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteChallenge(boss, missing)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses all writes to a non-admin", async () => {
    const id = await create("guarded");
    const db = await signedInClient(await createUser(admin, "adm-chal-plain"));
    await expect(saveChallenge(db, input("member"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      saveChallenge(db, { ...input("guarded", { title: `${tag} hacked` }), id }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(deleteChallenge(db, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { data } = await admin.from("challenges").select("title").eq("id", id).single();
    expect(data?.title).toBe(`${tag} guarded`);
  });
});

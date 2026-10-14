import { beforeAll, describe, expect, it } from "vitest";
import {
  createAdminWorkout,
  deleteAdminWorkout,
  getAdminWorkout,
  listAdminWorkouts,
  moveWorkoutToDate,
  reorderStarters,
  scheduleWorkout,
  updateAdminWorkout,
} from "@/server/admin/workouts";
import {
  adminClient,
  createAdminUser,
  createUser,
  freeWorkoutId,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let bossId: string;

beforeAll(async () => {
  admin = adminClient();
  const created = await createAdminUser(admin, "wk-admin");
  boss = created.db;
  bossId = created.user.id;
});

const input = (over: Record<string, unknown> = {}) => ({
  title: "Корем 25",
  description: "",
  kind: "regular",
  level: "advanced",
  durationMin: 25,
  focus: ["core"],
  videoUrl: "youtu.be/ml6cT4AZdqI",
  thumbnailUrl: null,
  publishAt: null,
  notify: true,
  ...over,
});

describe("admin workouts service", () => {
  it("creates a draft with normalised media and reads it back", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    const w = await getAdminWorkout(boss, id);
    expect(w).toMatchObject({
      title: "Корем 25",
      status: "draft",
      videoUrl: "https://youtu.be/ml6cT4AZdqI",
      completions: 0,
      level: "advanced",
    });
  });

  it("rejects a non-video link and a regular workout without level", async () => {
    await expect(
      createAdminWorkout(boss, bossId, input({ videoUrl: "https://example.com/v" })),
    ).rejects.toThrow();
    await expect(createAdminWorkout(boss, bossId, input({ level: null }))).rejects.toThrow();
  });

  it("appends a new starter at the end of the starter week", async () => {
    const id = await createAdminWorkout(
      boss,
      bossId,
      input({ kind: "starter", level: null, title: "Старт 6" }),
    );
    const w = await getAdminWorkout(boss, id);
    const { data } = await admin
      .from("workouts")
      .select("starter_order")
      .eq("kind", "starter")
      .order("starter_order", { ascending: false })
      .limit(1)
      .single();
    expect(w?.starterOrder).toBe(data?.starter_order);
    await deleteAdminWorkout(boss, id);
  });

  it("refuses a second free workout", async () => {
    await expect(
      createAdminWorkout(boss, bossId, input({ kind: "free", level: null })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("updates metadata and the link", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await updateAdminWorkout(
      boss,
      id,
      input({ title: "Корем 30", durationMin: 30, videoUrl: "https://vimeo.com/76979871" }),
    );
    expect(await getAdminWorkout(boss, id)).toMatchObject({
      title: "Корем 30",
      durationMin: 30,
      videoUrl: "https://vimeo.com/76979871",
    });
  });

  it("schedules, moves to another day keeping the Sofia time, and hides again", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await scheduleWorkout(boss, id, "2031-10-20T15:30:00.000Z"); // 18:30 Sofia
    await moveWorkoutToDate(boss, id, "2031-10-28"); // after DST end → 16:30Z
    expect(Date.parse((await getAdminWorkout(boss, id))!.publishAt!)).toBe(
      Date.parse("2031-10-28T16:30:00Z"),
    );
    await scheduleWorkout(boss, id, null);
    expect((await getAdminWorkout(boss, id))?.status).toBe("draft");
  });

  it("moves a draft to 07:00 Sofia on the chosen day", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await moveWorkoutToDate(boss, id, "2031-12-02");
    expect(Date.parse((await getAdminWorkout(boss, id))!.publishAt!)).toBe(
      Date.parse("2031-12-02T05:00:00Z"),
    );
  });

  it("deletes an unused workout and refuses a completed one, keeping its history", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await deleteAdminWorkout(boss, id);
    expect(await getAdminWorkout(boss, id)).toBeNull();
    const freeId = await freeWorkoutId(admin);
    const member = await signedInClient(await createUser(admin, "wk-done"));
    await member.from("workout_completions").insert({ workout_id: freeId });
    await expect(deleteAdminWorkout(boss, freeId)).rejects.toMatchObject({ code: "CONFLICT" });
    const { count } = await admin
      .from("workout_completions")
      .select("id", { count: "exact", head: true })
      .eq("workout_id", freeId);
    expect(count).toBeGreaterThan(0);
  });

  it("lists with filters and completion counts", async () => {
    const id = await createAdminWorkout(
      boss,
      bossId,
      input({ title: `Филтър ${Date.now()}`, level: "pro" }),
    );
    const found = await listAdminWorkouts(boss, {
      level: "pro",
      status: "draft",
      search: "Филтър",
    });
    expect(found.map((w) => w.id)).toContain(id);
    const free = (await listAdminWorkouts(boss, { kind: "free" }))[0];
    expect(free?.completions).toBeGreaterThan(0);
  });

  it("reorders the starter week and refuses an incomplete list", async () => {
    const before = await listAdminWorkouts(boss, { kind: "starter" });
    const ids = before
      .sort((a, b) => (a.starterOrder ?? 0) - (b.starterOrder ?? 0))
      .map((w) => w.id);
    expect(ids.length).toBeGreaterThan(1);
    await expect(reorderStarters(boss, ids.slice(1))).rejects.toMatchObject({ code: "INVALID" });
    const reversed = [...ids].reverse();
    await reorderStarters(boss, reversed);
    try {
      const after = await listAdminWorkouts(boss, { kind: "starter" });
      expect(
        after.sort((a, b) => (a.starterOrder ?? 0) - (b.starterOrder ?? 0)).map((w) => w.id),
      ).toEqual(reversed);
    } finally {
      await reorderStarters(boss, ids);
    }
  });
});

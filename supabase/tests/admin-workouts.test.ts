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
  workoutInputSchema,
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

  const BUCKET_URL =
    "http://127.0.0.1:54321/storage/v1/object/public/thumbnails/0b9f1c1e-6a52-4e0b-8d3e-5a1c2f3b4d5e.jpg";

  it("keeps the stored thumbnail on an update without one, and clears it only on explicit null", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await admin.from("workouts").update({ thumbnail_url: BUCKET_URL }).eq("id", id);
    const withoutThumb: Record<string, unknown> = input();
    delete withoutThumb.thumbnailUrl;
    await updateAdminWorkout(boss, id, { ...withoutThumb, title: "Нов заглавие" });
    expect(await getAdminWorkout(boss, id)).toMatchObject({
      title: "Нов заглавие",
      thumbnailUrl: BUCKET_URL,
    });
    await updateAdminWorkout(boss, id, input({ thumbnailUrl: null }));
    expect((await getAdminWorkout(boss, id))?.thumbnailUrl).toBeNull();
  });

  it("accepts only thumbnails from our own bucket", async () => {
    for (const bad of [
      "https://img.youtube.com/vi/ml6cT4AZdqI/0.jpg",
      "https://i.vimeocdn.com/video/1.jpg",
      "https://evil.example/a.jpg",
      "javascript:alert(1)",
      "https://x.example/storage/v1/object/public/thumbnails/../secret.jpg",
    ]) {
      expect(workoutInputSchema.safeParse(input({ thumbnailUrl: bad })).success, bad).toBe(false);
    }
    expect(workoutInputSchema.safeParse(input({ thumbnailUrl: BUCKET_URL })).success).toBe(true);
    await expect(
      createAdminWorkout(
        boss,
        bossId,
        input({ thumbnailUrl: "https://img.youtube.com/vi/x/0.jpg" }),
      ),
    ).rejects.toThrow();
  });

  it("gives each concurrent new starter its own order", async () => {
    const [a, b] = await Promise.all([
      createAdminWorkout(
        boss,
        bossId,
        input({ kind: "starter", level: null, title: "Старт гонка A" }),
      ),
      createAdminWorkout(
        boss,
        bossId,
        input({ kind: "starter", level: null, title: "Старт гонка B" }),
      ),
    ]);
    try {
      const [wa, wb] = await Promise.all([getAdminWorkout(boss, a), getAdminWorkout(boss, b)]);
      expect(wa?.starterOrder).not.toBe(wb?.starterOrder);
    } finally {
      await deleteAdminWorkout(boss, a);
      await deleteAdminWorkout(boss, b);
    }
  });

  it("assigns and clears the starter order when the kind changes", async () => {
    const { data } = await admin
      .from("workouts")
      .select("starter_order")
      .eq("kind", "starter")
      .order("starter_order", { ascending: false })
      .limit(1)
      .single();
    const id = await createAdminWorkout(boss, bossId, input());
    expect((await getAdminWorkout(boss, id))?.starterOrder).toBeNull();
    await updateAdminWorkout(boss, id, input({ kind: "starter", level: null }));
    expect(await getAdminWorkout(boss, id)).toMatchObject({
      kind: "starter",
      level: null,
      starterOrder: (data?.starter_order ?? 0) + 1,
    });
    await updateAdminWorkout(boss, id, input({ kind: "regular", level: "pro" }));
    expect(await getAdminWorkout(boss, id)).toMatchObject({
      kind: "regular",
      level: "pro",
      starterOrder: null,
    });
  });

  it("refuses to turn a workout into a second free one, with the free message", async () => {
    const id = await createAdminWorkout(boss, bossId, input());
    await expect(
      updateAdminWorkout(boss, id, input({ kind: "free", level: null })),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      userMessage: "Вече има безплатна тренировка.",
    });
    expect((await getAdminWorkout(boss, id))?.kind).toBe("regular");
  });

  it("treats %, _ and \\ in the search as literal characters", async () => {
    const stamp = Date.now();
    const literal = await createAdminWorkout(boss, bossId, input({ title: `Лит ${stamp}_x%y` }));
    const other = await createAdminWorkout(boss, bossId, input({ title: `Лит ${stamp}ZxQQy` }));
    const found = (await listAdminWorkouts(boss, { search: `${stamp}_x%y` })).map((w) => w.id);
    expect(found).toContain(literal);
    expect(found).not.toContain(other);
    expect(await listAdminWorkouts(boss, { search: `${stamp}\\` })).toEqual([]);
  });
});

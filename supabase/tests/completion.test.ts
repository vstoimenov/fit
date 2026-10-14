import { beforeAll, describe, expect, it } from "vitest";
import { markWorkoutComplete, setCompletionFeeling } from "@/server/content/completion";
import { getWorkoutForPlayer } from "@/server/content/workouts";
import {
  adminClient,
  createUser,
  createWorkout,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let freeId: string;
let paidId: string;

beforeAll(async () => {
  admin = adminClient();
  freeId = await freeWorkoutId(admin);
  const { data } = await admin
    .from("workouts")
    .select("id")
    .eq("kind", "regular")
    .lte("publish_at", new Date().toISOString())
    .limit(1)
    .single();
  paidId = data!.id;
});

describe("getWorkoutForPlayer", () => {
  it("returns an embed for the free workout and a locked view for paid ones", async () => {
    const db = await signedInClient(await createUser(admin, "player"));
    const free = await getWorkoutForPlayer(db, freeId);
    expect(free?.state).toBe("ok");
    expect(free?.state === "ok" && free.embedUrl).toMatch(
      /^https:\/\/www\.youtube-nocookie\.com\/embed\//,
    );
    const paid = await getWorkoutForPlayer(db, paidId);
    expect(paid).toMatchObject({ state: "locked", workout: { id: paidId } });
    expect(paid && "embedUrl" in paid).toBe(false);
  });

  it("reports a broken link instead of a lock when the stored URL does not parse", async () => {
    const user = await createUser(admin, "broken");
    await grantAccess(admin, user.id);
    const brokenId = await createWorkout(admin, {
      title: "Счупен линк",
      kind: "regular",
      level: "pro",
      duration_min: 10,
      publish_at: new Date(Date.now() - 60_000).toISOString(),
    });
    await admin
      .from("workout_media")
      .update({ video_url: "https://example.com/video" })
      .eq("workout_id", brokenId);
    const view = await getWorkoutForPlayer(await signedInClient(user), brokenId);
    expect(view?.state).toBe("broken");
  });

  it("returns null for an unknown or malformed id", async () => {
    const db = await signedInClient(await createUser(admin, "player-404"));
    expect(await getWorkoutForPlayer(db, crypto.randomUUID())).toBeNull();
    expect(await getWorkoutForPlayer(db, "not-a-uuid")).toBeNull();
  });
});

describe("markWorkoutComplete", () => {
  it("is idempotent within a day", async () => {
    const user = await createUser(admin, "twice");
    const db = await signedInClient(user);
    const first = await markWorkoutComplete(db, user.id, freeId);
    const second = await markWorkoutComplete(db, user.id, freeId);
    expect(first.status).toBe("done");
    expect(second).toEqual({ status: "already", completionId: first.completionId });
  });

  it("returns the caller's own completion on a second tap even when an admin can see everyone's", async () => {
    const normal = await createUser(admin, "normal-done");
    const boss = await createUser(admin, "boss-done");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
    const normalDb = await signedInClient(normal);
    const bossDb = await signedInClient(boss);
    const normalFirst = await markWorkoutComplete(normalDb, normal.id, freeId);
    const bossFirst = await markWorkoutComplete(bossDb, boss.id, freeId);
    const bossSecond = await markWorkoutComplete(bossDb, boss.id, freeId);
    expect(bossFirst.completionId).not.toBe(normalFirst.completionId);
    expect(bossSecond).toEqual({ status: "already", completionId: bossFirst.completionId });
  });

  it("refuses a locked workout with a readable error", async () => {
    const user = await createUser(admin, "locked");
    const db = await signedInClient(user);
    await expect(markWorkoutComplete(db, user.id, paidId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("stores how the workout felt", async () => {
    const user = await createUser(admin, "feel");
    const db = await signedInClient(user);
    const { completionId } = await markWorkoutComplete(db, user.id, freeId);
    await setCompletionFeeling(db, completionId, "hard");
    const { data } = await admin
      .from("workout_completions")
      .select("feeling")
      .eq("id", completionId)
      .single();
    expect(data?.feeling).toBe("hard");
  });
});

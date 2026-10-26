import { describe, expect, it } from "vitest";
import {
  adminClient,
  createAdminUser,
  createUser,
  createWorkout,
  freeWorkoutId,
  grantAccess,
  signedInClient,
} from "./helpers";

describe("workout_watches", () => {
  it("a member marks and unmarks her own workout, and sees only her rows", async () => {
    const admin = adminClient();
    const workoutId = await freeWorkoutId(admin);
    const me = await createUser(admin, "watch-me");
    const other = await createUser(admin, "watch-other");
    const mine = await signedInClient(me);
    const theirs = await signedInClient(other);

    const { error } = await mine.from("workout_watches").insert({ workout_id: workoutId });
    expect(error).toBeNull();
    // Idempotent: a second mark is a no-op through upsert.
    const again = await mine
      .from("workout_watches")
      .upsert(
        { workout_id: workoutId },
        { onConflict: "user_id,workout_id", ignoreDuplicates: true },
      );
    expect(again.error).toBeNull();

    const seenByMe = await mine.from("workout_watches").select("workout_id");
    expect(seenByMe.data?.map((r) => r.workout_id)).toEqual([workoutId]);
    const seenByOther = await theirs.from("workout_watches").select("workout_id");
    expect(seenByOther.data).toEqual([]);

    // Nobody can plant a mark on someone else.
    const planted = await theirs
      .from("workout_watches")
      .insert({ workout_id: workoutId, user_id: me.id });
    expect(planted.error).not.toBeNull();

    // Another member's delete is a silent no-op under RLS.
    await theirs.from("workout_watches").delete().eq("workout_id", workoutId);
    expect((await mine.from("workout_watches").select("workout_id")).data).toHaveLength(1);

    const removed = await mine.from("workout_watches").delete().eq("workout_id", workoutId);
    expect(removed.error).toBeNull();
    expect((await mine.from("workout_watches").select("workout_id")).data).toEqual([]);
  });

  it("refuses a mark on a workout she may not watch", async () => {
    const admin = adminClient();
    const paidId = await createWorkout(admin, {
      title: "Платена",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      focus: ["full_body"],
      publish_at: new Date(Date.now() - 60_000).toISOString(),
    });
    const db = await signedInClient(await createUser(admin, "watch-locked"));
    const { error } = await db.from("workout_watches").insert({ workout_id: paidId });
    expect(error?.code).toBe("42501");
  });

  it("an admin can read every member's marks", async () => {
    const admin = adminClient();
    const workoutId = await freeWorkoutId(admin);
    const member = await createUser(admin, "watch-seen-by-admin");
    await (await signedInClient(member)).from("workout_watches").insert({ workout_id: workoutId });
    const { db } = await createAdminUser(admin, "watch-admin");
    const { data } = await db.from("workout_watches").select("user_id").eq("user_id", member.id);
    expect(data).toEqual([{ user_id: member.id }]);
  });

  it("a saved completion also marks the workout as watched", async () => {
    const admin = adminClient();
    const workoutId = await freeWorkoutId(admin);
    const user = await createUser(admin, "watch-complete");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);
    const { error } = await db.from("workout_completions").insert({ workout_id: workoutId });
    expect(error).toBeNull();
    const { data } = await db
      .from("workout_watches")
      .select("workout_id")
      .eq("workout_id", workoutId);
    expect(data).toEqual([{ workout_id: workoutId }]);
  });
});

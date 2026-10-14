import { beforeAll, describe, expect, it } from "vitest";
import { getTodayView } from "@/server/content/today";
import {
  adminClient,
  createUser,
  freeWorkoutId,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("getTodayView", () => {
  it("leads a new user without access to the free workout", async () => {
    const user = await createUser(admin, "today-free", { name: "Ани" });
    const view = await getTodayView(await signedInClient(user), user.id);
    expect(view.pick).toEqual({ kind: "free", workoutId: await freeWorkoutId(admin) });
    expect(view.workout?.kind).toBe("free");
    expect(view.hasAccess).toBe(false);
    expect(view.name).toBe("Ани");
  });

  it("starts a subscriber on starter 1 and shows the next beginner drop", async () => {
    const user = await createUser(admin, "today-sub");
    await grantAccess(admin, user.id);
    const view = await getTodayView(await signedInClient(user), user.id);
    expect(view.pick).toMatchObject({ kind: "starter", index: 1 });
    expect(view.workout?.starterOrder).toBe(1);
    expect(view.nextDropAt).not.toBeNull();
    expect(view.week).toHaveLength(7);
  });

  it("counts finished workouts", async () => {
    const user = await createUser(admin, "today-done");
    const db = await signedInClient(user);
    await db.from("workout_completions").insert({ workout_id: await freeWorkoutId(admin) });
    const view = await getTodayView(db, user.id);
    expect(view.doneTotal).toBe(1);
    expect(view.pick).toEqual({ kind: "locked" });
  });
});

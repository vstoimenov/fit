import { beforeAll, describe, expect, it } from "vitest";
import { getTodayView } from "@/server/content/today";
import { listPublishedWorkouts } from "@/server/content/workouts";
import {
  adminClient,
  createAdminUser,
  createUser,
  createWorkout,
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

describe("admins see drafts through RLS but the services only treat published workouts as content", () => {
  const day = 86_400_000;

  async function adminUser() {
    return createAdminUser(admin, "today-admin");
  }

  it("lists no unpublished or future workout in the library", async () => {
    const { db } = await adminUser();
    const draftId = await createWorkout(admin, {
      title: "Чернова",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      publish_at: null,
    });
    const futureId = await createWorkout(admin, {
      title: "Утрешна",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      publish_at: new Date(Date.now() + day).toISOString(),
    });
    // Precondition: RLS lets the admin read both, so the filter below is what hides them.
    const raw = await db.from("workouts").select("id").in("id", [draftId, futureId]);
    expect(raw.data).toHaveLength(2);

    const ids = (await listPublishedWorkouts(db)).map((w) => w.id);
    expect(ids).not.toContain(draftId);
    expect(ids).not.toContain(futureId);
    expect(ids).toContain(await freeWorkoutId(admin));
  });

  it("does not let unpublished workouts into the week strip or the streak", async () => {
    const { user: adminUserRow, db: adminDb } = await adminUser();
    const client = await createUser(admin, "today-client");
    await createWorkout(admin, {
      title: "Скрита чернова",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      publish_at: null,
    });
    await createWorkout(admin, {
      title: "Скрита утрешна",
      kind: "regular",
      level: "beginner",
      duration_min: 20,
      publish_at: new Date(Date.now() + day).toISOString(),
    });
    const asAdmin = await getTodayView(adminDb, adminUserRow.id);
    const asClient = await getTodayView(await signedInClient(client), client.id);
    expect(asAdmin.week.map((d) => d.slot)).toEqual(asClient.week.map((d) => d.slot));
    expect(asAdmin.streak).toBe(asClient.streak);
  });
});

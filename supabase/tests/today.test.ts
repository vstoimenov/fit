import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { getTodayView } from "@/server/content/today";
import { getLibrary, listPublishedWorkouts } from "@/server/content/workouts";
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

  it("exposes the member's timezone for the date line", async () => {
    const user = await createUser(admin, "today-tz");
    await admin.from("profiles").update({ timezone: "America/Los_Angeles" }).eq("id", user.id);
    const view = await getTodayView(await signedInClient(user), user.id);
    expect(view.timezone).toBe("America/Los_Angeles");
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

describe("getTodayView profile errors", () => {
  it("reports a missing profile as NOT_FOUND", async () => {
    const user = await createUser(admin, "today-missing");
    const db = await signedInClient(user);
    await expect(getTodayView(db, randomUUID())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not disguise a failing profile query as NOT_FOUND", async () => {
    const failing = {
      from: (table: string) => {
        const result =
          table === "profiles"
            ? { data: null, error: { code: "57P01", message: "connection lost" } }
            : { data: [], error: null };
        const chain: Record<string, unknown> = {
          then: (resolve: (v: unknown) => unknown) => resolve(result),
        };
        for (const m of ["select", "eq", "not", "lte", "single"]) chain[m] = () => chain;
        return chain;
      },
      rpc: () => Promise.resolve({ data: [], error: null }),
    } as unknown as TypedClient;
    await expect(getTodayView(failing, randomUUID())).rejects.toThrow(
      "load profile failed: connection lost",
    );
  });
});

describe("getLibrary", () => {
  async function seedLevels() {
    const mk = (level: "beginner" | "advanced" | "pro") =>
      createWorkout(admin, {
        title: `lib-${level}`,
        kind: "regular",
        level,
        duration_min: 20,
        publish_at: new Date(Date.now() - 1000).toISOString(),
      });
    return { beginner: await mk("beginner"), advanced: await mk("advanced"), pro: await mk("pro") };
  }

  it("returns only the member's level of regular workouts, keeping free and starter ones", async () => {
    const ids = await seedLevels();
    const user = await createUser(admin, "lib-beginner");
    const db = await signedInClient(user);
    const lib = await getLibrary(db, user.id);
    expect(lib.level).toBe("beginner");
    const got = lib.workouts.map((w) => w.id);
    expect(got).toContain(ids.beginner);
    expect(got).not.toContain(ids.advanced);
    expect(got).not.toContain(ids.pro);
    expect(
      lib.workouts.filter((w) => w.kind === "regular").every((w) => w.level === "beginner"),
    ).toBe(true);
    expect(lib.workouts.some((w) => w.kind === "starter")).toBe(true);
    expect(got).toContain(await freeWorkoutId(admin));
  });

  it("an advanced member sees only advanced regular workouts", async () => {
    const ids = await seedLevels();
    const user = await createUser(admin, "lib-advanced");
    await admin.from("profiles").update({ level: "advanced" }).eq("id", user.id);
    const lib = await getLibrary(await signedInClient(user), user.id);
    expect(lib.level).toBe("advanced");
    const got = lib.workouts.map((w) => w.id);
    expect(got).toContain(ids.advanced);
    expect(got).not.toContain(ids.beginner);
    expect(got).not.toContain(ids.pro);
  });

  it("falls back to beginner when the profile cannot be read", async () => {
    const lib = await getLibrary(
      await signedInClient(await createUser(admin, "lib-nofile")),
      randomUUID(),
    );
    expect(lib.level).toBe("beginner");
  });
});

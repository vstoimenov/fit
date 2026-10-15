import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createAdminUser,
  createUser,
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
  const { data, error } = await admin
    .from("workouts")
    .select("id")
    .eq("kind", "regular")
    .lte("publish_at", new Date().toISOString())
    .limit(1)
    .single();
  if (error || !data) throw error ?? new Error("seed has no published regular workout");
  paidId = data.id;
});

const DB_CONTAINER = "supabase_db_fit-platform"; // this project's local stack only

function psql(sql: string): string {
  return execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-tAc", sql], {
    encoding: "utf8",
    env: { ...process.env, DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "/tmp/dockercfg" },
  }).trim();
}

/** Completions the service role can see for a user (proves a rejected/hidden row really is absent/present). */
async function completionCount(userId: string, workoutId?: string): Promise<number> {
  let query = admin.from("workout_completions").select("id").eq("user_id", userId);
  if (workoutId) query = query.eq("workout_id", workoutId);
  const { data, error } = await query;
  expect(error).toBeNull();
  return (data ?? []).length;
}

describe("workout_completions", () => {
  it("dates a completion by the user's local day, not UTC", async () => {
    const user = await createUser(admin, "tz");
    // 21:30 UTC on 14 Oct = 00:30 on 15 Oct in Sofia (UTC+3, summer time).
    const { data, error } = await admin
      .from("workout_completions")
      .insert({
        user_id: user.id,
        workout_id: freeId,
        completed_at: "2026-10-14T21:30:00Z",
        local_date: "2000-01-01",
      })
      .select("local_date")
      .single();
    expect(error).toBeNull();
    expect(data?.local_date).toBe("2026-10-15");
  });

  it("uses the profile's own timezone for the local day", async () => {
    const user = await createUser(admin, "tz-utc");
    const set = await admin.from("profiles").update({ timezone: "UTC" }).eq("id", user.id);
    expect(set.error).toBeNull();
    const { data, error } = await admin
      .from("workout_completions")
      .insert({ user_id: user.id, workout_id: freeId, completed_at: "2026-10-14T21:30:00Z" })
      .select("local_date")
      .single();
    expect(error).toBeNull();
    expect(data?.local_date).toBe("2026-10-14");
  });

  it("lets a user complete the free workout but not a locked one", async () => {
    const user = await createUser(admin, "lock");
    const db = await signedInClient(user);
    const ok = await db.from("workout_completions").insert({ workout_id: freeId });
    expect(ok.error).toBeNull();
    expect(await completionCount(user.id, freeId)).toBe(1);

    const denied = await db.from("workout_completions").insert({ workout_id: paidId });
    expect(denied.error?.code).toBe("42501");
    expect(await completionCount(user.id, paidId)).toBe(0);
  });

  it("lets a subscriber complete a paid workout", async () => {
    const user = await createUser(admin, "paid");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);
    const { error } = await db.from("workout_completions").insert({ workout_id: paidId });
    expect(error).toBeNull();
    expect(await completionCount(user.id, paidId)).toBe(1);
  });

  it("refuses a second completion of the same workout on the same day", async () => {
    const user = await createUser(admin, "dup");
    const db = await signedInClient(user);
    const first = await db.from("workout_completions").insert({ workout_id: freeId });
    expect(first.error).toBeNull();
    const again = await db.from("workout_completions").insert({ workout_id: freeId });
    expect(again.error?.code).toBe("23505");
    expect(await completionCount(user.id, freeId)).toBe(1);
  });

  it("refuses a backdated completion from the client", async () => {
    const user = await createUser(admin, "back");
    const db = await signedInClient(user);
    const { error } = await db
      .from("workout_completions")
      .insert({ workout_id: freeId, completed_at: "2020-01-01T00:00:00Z" });
    expect(error?.code).toBe("42501");
    expect(await completionCount(user.id)).toBe(0);
  });

  it("refuses a client-supplied local_date or user_id", async () => {
    const user = await createUser(admin, "forge");
    const other = await createUser(admin, "forge-other");
    const db = await signedInClient(user);
    const dated = await db
      .from("workout_completions")
      .insert({ workout_id: freeId, local_date: "2020-01-01" });
    expect(dated.error?.code).toBe("42501");
    const forged = await db
      .from("workout_completions")
      .insert({ workout_id: freeId, user_id: other.id });
    expect(forged.error?.code).toBe("42501");
    expect(await completionCount(user.id)).toBe(0);
    expect(await completionCount(other.id)).toBe(0);
  });

  it("lets the owner change the feeling but nothing else, and not someone else's row", async () => {
    const a = await createUser(admin, "upd-a");
    const b = await createUser(admin, "upd-b");
    const dbA = await signedInClient(a);
    const dbB = await signedInClient(b);
    const made = await dbA.from("workout_completions").insert({ workout_id: freeId });
    expect(made.error).toBeNull();

    const own = await dbA
      .from("workout_completions")
      .update({ feeling: "hard" })
      .eq("workout_id", freeId)
      .select("feeling");
    expect(own.error).toBeNull();
    expect(own.data).toEqual([{ feeling: "hard" }]);

    const moved = await dbA
      .from("workout_completions")
      .update({ completed_at: "2020-01-01T00:00:00Z" })
      .eq("workout_id", freeId);
    expect(moved.error?.code).toBe("42501");

    const foreign = await dbB
      .from("workout_completions")
      .update({ feeling: "easy" })
      .eq("user_id", a.id)
      .select("id");
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);

    const { data: row } = await admin
      .from("workout_completions")
      .select("feeling")
      .eq("user_id", a.id)
      .single();
    expect(row?.feeling).toBe("hard");
  });

  it("shows completions to their owner and an admin, hides them from others", async () => {
    const a = await createUser(admin, "see-a");
    const b = await createUser(admin, "see-b");
    const { db: bossDb } = await createAdminUser(admin, "see-admin");
    const made = await (
      await signedInClient(a)
    )
      .from("workout_completions")
      .insert({ workout_id: freeId });
    expect(made.error).toBeNull();

    const own = await (
      await signedInClient(a)
    )
      .from("workout_completions")
      .select("id")
      .eq("user_id", a.id);
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);

    const other = await (
      await signedInClient(b)
    )
      .from("workout_completions")
      .select("id")
      .eq("user_id", a.id);
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);

    const seenByAdmin = await bossDb.from("workout_completions").select("id").eq("user_id", a.id);
    expect(seenByAdmin.error).toBeNull();
    expect(seenByAdmin.data).toHaveLength(1);
  });

  it("ends the starter week after the last published starter", async () => {
    const user = await createUser(admin, "starter");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);
    const { data: starters, error: startersError } = await admin
      .from("workouts")
      .select("id")
      .eq("kind", "starter")
      .lte("publish_at", new Date().toISOString())
      .order("starter_order");
    expect(startersError).toBeNull();
    expect((starters ?? []).length).toBeGreaterThan(1);
    for (const [index, s] of (starters ?? []).entries()) {
      const { data: before } = await admin
        .from("profiles")
        .select("starter_week_done_at")
        .eq("id", user.id)
        .single();
      expect(before?.starter_week_done_at).toBeNull();
      const { error } = await db.from("workout_completions").insert({ workout_id: s.id });
      expect(error, `starter #${index + 1}`).toBeNull();
    }
    const { data: after } = await admin
      .from("profiles")
      .select("starter_week_done_at")
      .eq("id", user.id)
      .single();
    expect(after?.starter_week_done_at).not.toBeNull();
  });

  it("ignores unpublished starters when deciding the starter week is done", async () => {
    const user = await createUser(admin, "starter-unpub");
    const { data: starters } = await admin
      .from("workouts")
      .select("id")
      .eq("kind", "starter")
      .lte("publish_at", new Date().toISOString())
      .order("starter_order");
    const published = starters ?? [];
    expect(published.length).toBeGreaterThan(1);
    const { data: draft, error: draftError } = await admin
      .from("workouts")
      .insert({
        title: "Чернова старт",
        kind: "starter",
        starter_order: 100 + Math.floor(Math.random() * 800),
        duration_min: 10,
        publish_at: null,
      })
      .select("id")
      .single();
    expect(draftError).toBeNull();
    try {
      // Everything but the last published starter, plus the unpublished draft (service role only).
      const rows = [...published.slice(0, -1), draft!].map((w) => ({
        user_id: user.id,
        workout_id: w.id,
      }));
      const inserted = await admin.from("workout_completions").insert(rows);
      expect(inserted.error).toBeNull();
      const { data: mid } = await admin
        .from("profiles")
        .select("starter_week_done_at")
        .eq("id", user.id)
        .single();
      expect(mid?.starter_week_done_at).toBeNull();

      const last = await admin
        .from("workout_completions")
        .insert({ user_id: user.id, workout_id: published[published.length - 1]!.id });
      expect(last.error).toBeNull();
      const { data: done } = await admin
        .from("profiles")
        .select("starter_week_done_at")
        .eq("id", user.id)
        .single();
      expect(done?.starter_week_done_at).not.toBeNull();
    } finally {
      await admin.from("workouts").delete().eq("id", draft!.id);
    }
  });

  it("does not end the starter week for free or regular completions", async () => {
    const user = await createUser(admin, "no-starter");
    await grantAccess(admin, user.id);
    const db = await signedInClient(user);
    expect((await db.from("workout_completions").insert({ workout_id: freeId })).error).toBeNull();
    expect((await db.from("workout_completions").insert({ workout_id: paidId })).error).toBeNull();
    const { data } = await admin
      .from("profiles")
      .select("starter_week_done_at")
      .eq("id", user.id)
      .single();
    expect(data?.starter_week_done_at).toBeNull();
  });
});

describe("profile timezone", () => {
  it("rejects an invalid timezone on update and keeps the stored value", async () => {
    const user = await createUser(admin, "tz-bad");
    const db = await signedInClient(user);
    const bad = await db.from("profiles").update({ timezone: "Bad/Zone" }).eq("id", user.id);
    expect(bad.error?.code).toBe("23514");
    const { data } = await admin.from("profiles").select("timezone").eq("id", user.id).single();
    expect(data?.timezone).toBe("Europe/Sofia");

    const good = await db
      .from("profiles")
      .update({ timezone: "America/New_York" })
      .eq("id", user.id)
      .select("timezone");
    expect(good.error).toBeNull();
    expect(good.data).toEqual([{ timezone: "America/New_York" }]);
  });

  it("still dates a completion (Sofia fallback) when a bad zone is already stored", async () => {
    const user = await createUser(admin, "tz-legacy");
    // The write-time trigger (rightly) blocks bad zones, so simulate legacy bad data by disabling it
    // for a single statement through the local stack's own DB container. Always re-enabled in finally.
    try {
      psql(
        "alter table public.profiles disable trigger profiles_validate_timezone; " +
          `update public.profiles set timezone = 'Bad/Zone' where id = '${user.id}'; ` +
          "alter table public.profiles enable trigger profiles_validate_timezone;",
      );
    } finally {
      psql("alter table public.profiles enable trigger profiles_validate_timezone");
    }
    const { data: stored } = await admin
      .from("profiles")
      .select("timezone")
      .eq("id", user.id)
      .single();
    expect(stored?.timezone).toBe("Bad/Zone");

    const { data, error } = await admin
      .from("workout_completions")
      .insert({ user_id: user.id, workout_id: freeId, completed_at: "2026-10-14T21:30:00Z" })
      .select("local_date")
      .single();
    expect(error).toBeNull();
    // 21:30 UTC on 14 Oct = 15 Oct in Sofia.
    expect(data?.local_date).toBe("2026-10-15");
  });

  it("keeps the trigger enabled", () => {
    expect(
      psql("select tgenabled from pg_trigger where tgname = 'profiles_validate_timezone'"),
    ).toBe("O");
  });
});

describe("check_ins", () => {
  it("stores a user's own check-in and hides it from others", async () => {
    const a = await createUser(admin, "ci-a");
    const b = await createUser(admin, "ci-b");
    const dbA = await signedInClient(a);
    const { error } = await dbA.from("check_ins").insert({ weight_kg: 64.5, energy: 4 });
    expect(error).toBeNull();

    const { data: stored } = await admin.from("check_ins").select("id").eq("user_id", a.id);
    expect(stored).toHaveLength(1);

    const seenByB = await (
      await signedInClient(b)
    )
      .from("check_ins")
      .select("id")
      .eq("user_id", a.id);
    expect(seenByB.error).toBeNull();
    expect(seenByB.data).toEqual([]);

    const seenByA = await dbA.from("check_ins").select("id").eq("user_id", a.id);
    expect(seenByA.error).toBeNull();
    expect(seenByA.data).toHaveLength(1);
  });

  it("rejects an empty check-in", async () => {
    const db = await signedInClient(await createUser(admin, "ci-empty"));
    const { error } = await db.from("check_ins").insert({});
    expect(error?.code).toBe("23514");
  });

  it("accepts a note-only check-in and rejects out-of-range values", async () => {
    const user = await createUser(admin, "ci-range");
    const db = await signedInClient(user);
    expect((await db.from("check_ins").insert({ note: "Добре съм" })).error).toBeNull();
    expect((await db.from("check_ins").insert({ weight_kg: 10 })).error?.code).toBe("23514");
    expect((await db.from("check_ins").insert({ energy: 6 })).error?.code).toBe("23514");
    expect((await db.from("check_ins").insert({ note: "x".repeat(501) })).error?.code).toBe(
      "23514",
    );
    const { data } = await admin.from("check_ins").select("id").eq("user_id", user.id);
    expect(data).toHaveLength(1);
  });

  it("refuses a forged user_id or created_at", async () => {
    const user = await createUser(admin, "ci-forge");
    const other = await createUser(admin, "ci-forge-other");
    const db = await signedInClient(user);
    const forged = await db.from("check_ins").insert({ energy: 3, user_id: other.id });
    expect(forged.error?.code).toBe("42501");
    const dated = await db
      .from("check_ins")
      .insert({ energy: 3, created_at: "2020-01-01T00:00:00Z" });
    expect(dated.error?.code).toBe("42501");
    const { data } = await admin.from("check_ins").select("id").in("user_id", [user.id, other.id]);
    expect(data).toEqual([]);
  });

  it("lets a user delete their own check-in but not someone else's, and never edit", async () => {
    const a = await createUser(admin, "ci-del-a");
    const b = await createUser(admin, "ci-del-b");
    const dbA = await signedInClient(a);
    const dbB = await signedInClient(b);
    expect((await dbA.from("check_ins").insert({ energy: 2 })).error).toBeNull();

    const edit = await dbA.from("check_ins").update({ energy: 5 }).eq("user_id", a.id);
    expect(edit.error?.code).toBe("42501");

    const foreign = await dbB.from("check_ins").delete().eq("user_id", a.id).select("id");
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
    const { data: still } = await admin.from("check_ins").select("id").eq("user_id", a.id);
    expect(still).toHaveLength(1);

    const own = await dbA.from("check_ins").delete().eq("user_id", a.id).select("id");
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);
    const { data: gone } = await admin.from("check_ins").select("id").eq("user_id", a.id);
    expect(gone).toEqual([]);
  });

  it("shows every check-in to an admin", async () => {
    const a = await createUser(admin, "ci-adm-a");
    const { db: bossDb } = await createAdminUser(admin, "ci-adm");
    expect(
      (await (await signedInClient(a)).from("check_ins").insert({ energy: 4 })).error,
    ).toBeNull();
    const seen = await bossDb.from("check_ins").select("id").eq("user_id", a.id);
    expect(seen.error).toBeNull();
    expect(seen.data).toHaveLength(1);
  });
});

describe("visits", () => {
  it("is invisible and unwritable for clients", async () => {
    const db = await signedInClient(await createUser(admin, "visit"));
    const row = {
      anon_id: crypto.randomUUID(),
      path: "/visit-test-hidden",
      device: "mobile" as const,
    };
    const seeded = await admin.from("visits").insert(row);
    expect(seeded.error).toBeNull();

    const write = await db.from("visits").insert({ ...row, anon_id: crypto.randomUUID() });
    expect(write.error?.code).toBe("42501");
    const { data, error } = await db.from("visits").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const anonWrite = await anonClient().from("visits").insert(row);
    expect(anonWrite.error?.code).toBe("42501");
    const anonRead = await anonClient().from("visits").select("id");
    // anon keeps table SELECT; RLS (admin-only policy) returns zero rows.
    expect(anonRead.data ?? []).toEqual([]);
  });

  it("is readable by an admin", async () => {
    const { db: bossDb } = await createAdminUser(admin, "visit-admin");
    const path = `/visit-test-${Date.now()}`;
    expect(
      (await admin.from("visits").insert({ anon_id: crypto.randomUUID(), path, device: "desktop" }))
        .error,
    ).toBeNull();
    const { data, error } = await bossDb.from("visits").select("id").eq("path", path);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("rejects an unknown device", async () => {
    const { error } = await admin
      .from("visits")
      .insert({ anon_id: crypto.randomUUID(), path: "/", device: "fridge" });
    expect(error?.code).toBe("23514");
  });
});

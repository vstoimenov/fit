import { beforeAll, describe, expect, it } from "vitest";
import {
  getClientDetail,
  grantManualAccess,
  listAllClients,
  listClients,
  revokeManualAccess,
} from "@/server/admin/clients";
import { addNote, recordMessage } from "@/server/admin/notes";
import {
  adminClient,
  createAdminUser,
  createUser,
  freeWorkoutId,
  signedInClient,
  type TestUser,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
let bossUser: TestUser;

beforeAll(async () => {
  admin = adminClient();
  const created = await createAdminUser(admin, "cl-admin");
  boss = created.db;
  bossUser = created.user;
});

async function access(userId: string) {
  const { data } = await admin.rpc("has_active_access", { uid: userId });
  return data === true;
}

describe("clients service", () => {
  it("lists and finds a client by email", async () => {
    const user = await createUser(admin, "cl-find", { name: "Яна" });
    const { rows, total } = await listClients(boss, { search: user.email });
    expect(total).toBe(1);
    expect(rows[0]).toMatchObject({ userId: user.id, name: "Яна", hasAccess: false, totalDone: 0 });
  });

  it("pages through clients with identical join times without gaps or repeats", async () => {
    const token = `cl-tie-${Math.random().toString(36).slice(2, 8)}`;
    const users = await Promise.all([1, 2, 3, 4, 5, 6].map(() => createUser(admin, token)));
    const same = new Date(Date.now() - 86_400_000).toISOString();
    await admin
      .from("profiles")
      .update({ joined_at: same })
      .in(
        "id",
        users.map((u) => u.id),
      );
    const seen: string[] = [];
    for (let offset = 0; offset < 8; offset += 2) {
      const { rows } = await listClients(boss, { search: token, limit: 2, offset });
      seen.push(...rows.map((r) => r.userId));
    }
    // Equal join times fall back to the id, so the order is exactly ascending by id across every page.
    expect(seen).toEqual(users.map((u) => u.id).sort());
  });

  it("listAllClients returns one row per client even if a page repeats a row", async () => {
    const user = await createUser(admin, "cl-dupe");
    const real = (await listClients(boss, { search: user.email })).rows[0]!;
    const row = {
      user_id: real.userId,
      name: real.name,
      email: real.email,
      phone: null,
      phone_call_consent: false,
      level: real.level,
      joined_at: real.joinedAt,
      last_seen_at: null,
      onboarding_done: false,
      sub_status: null,
      sub_provider: null,
      current_period_end: null,
      has_access: false,
      total_done: 0,
      last_done_at: null,
      done_7: 0,
      done_30: 0,
      minutes_7: 0,
      minutes_30: 0,
      published_14: 0,
      done_regular_14: 0,
      paid_without_workout: false,
      snoozed_until: null,
    };
    // Page 1 and page 2 both contain the same client, as when a signup shifts the offsets mid-scan.
    const pages = [
      [{ ...row, total_count: 3 }],
      [{ ...row, total_count: 3 }],
      [{ ...row, user_id: crypto.randomUUID(), total_count: 3 }],
    ];
    let call = 0;
    const fake = {
      rpc: async () => ({ data: pages[call++], error: null }),
    } as unknown as TypedClient;
    const all = await listAllClients(fake, { pageSize: 1 });
    expect(all.map((c) => c.userId).filter((id) => id === user.id)).toHaveLength(1);
    expect(all).toHaveLength(2);
  });

  it("reports the real workout total while listing only the latest 60", async () => {
    const user = await createUser(admin, "cl-many");
    const workout = await freeWorkoutId(admin);
    const rows = Array.from({ length: 61 }, (_, i) => ({
      user_id: user.id,
      workout_id: workout,
      completed_at: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
    }));
    const { error } = await admin.from("workout_completions").insert(rows);
    expect(error).toBeNull();
    const detail = await getClientDetail(boss, user.id);
    expect(detail?.completionsTotal).toBe(61);
    expect(detail?.completions).toHaveLength(60);
    const fresh = await createUser(admin, "cl-none");
    expect((await getClientDetail(boss, fresh.id))?.completionsTotal).toBe(0);
  });

  it("never lists admins, and their detail is not found", async () => {
    const { rows } = await listClients(boss, { search: bossUser.email });
    expect(rows).toEqual([]);
    expect(await getClientDetail(boss, bossUser.id)).toBeNull();
  });

  it("grants manual access for N days and revokes it", async () => {
    const user = await createUser(admin, "cl-grant");
    await grantManualAccess(boss, user.id, 14);
    expect(await access(user.id)).toBe(true);
    const { data } = await admin
      .from("subscriptions")
      .select("provider, current_period_end")
      .eq("user_id", user.id)
      .single();
    expect(data?.provider).toBe("manual");
    expect(Date.parse(data!.current_period_end!) - Date.now()).toBeGreaterThan(13 * 86_400_000);
    await revokeManualAccess(boss, user.id);
    expect(await access(user.id)).toBe(false);
    // a revoked grant can be given again
    await grantManualAccess(boss, user.id, 3);
    expect(await access(user.id)).toBe(true);
  });

  it("extends a still-active manual grant instead of overwriting it, and restarts a lapsed one from now", async () => {
    const user = await createUser(admin, "cl-extend");
    const day = 86_400_000;
    await admin.from("subscriptions").insert({
      user_id: user.id,
      provider: "manual",
      status: "active",
      current_period_end: new Date(Date.now() + 200 * day).toISOString(),
    });
    await grantManualAccess(boss, user.id, 30);
    const read = async () => {
      const { data } = await admin
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .single();
      return {
        status: data!.status,
        daysLeft: (Date.parse(data!.current_period_end!) - Date.now()) / day,
      };
    };
    const extended = await read();
    expect(extended.status).toBe("active");
    expect(extended.daysLeft).toBeGreaterThan(229);
    expect(extended.daysLeft).toBeLessThan(231);

    await revokeManualAccess(boss, user.id);
    await grantManualAccess(boss, user.id, 10);
    const restarted = await read();
    expect(restarted.daysLeft).toBeGreaterThan(9);
    expect(restarted.daysLeft).toBeLessThan(11);

    // an expired (not revoked) grant also starts from now
    await admin
      .from("subscriptions")
      .update({ current_period_end: new Date(Date.now() - 5 * day).toISOString() })
      .eq("user_id", user.id);
    await grantManualAccess(boss, user.id, 10);
    expect((await read()).daysLeft).toBeLessThan(11);
  });

  it("refuses manual access over a paid subscription and leaves it untouched", async () => {
    const user = await createUser(admin, "cl-paid");
    await admin
      .from("subscriptions")
      .insert({ user_id: user.id, provider: "stripe", status: "active" });
    await expect(grantManualAccess(boss, user.id, 7)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(revokeManualAccess(boss, user.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const { data } = await admin
      .from("subscriptions")
      .select("provider, status")
      .eq("user_id", user.id)
      .single();
    expect(data).toEqual({ provider: "stripe", status: "active" });
    expect(await access(user.id)).toBe(true);
  });

  it("lets a former customer (canceled, period over) be granted access", async () => {
    const user = await createUser(admin, "cl-former");
    await admin.from("subscriptions").insert({
      user_id: user.id,
      provider: "stripe",
      status: "canceled",
      current_period_end: new Date(Date.now() - 3 * 86_400_000).toISOString(),
      canceled_at: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    });
    expect(await access(user.id)).toBe(false);
    await grantManualAccess(boss, user.id, 20);
    expect(await access(user.id)).toBe(true);
    const { data } = await admin
      .from("subscriptions")
      .select("provider, status")
      .eq("user_id", user.id)
      .single();
    expect(data).toEqual({ provider: "manual", status: "active" });
  });

  it("returns the new end of access", async () => {
    const user = await createUser(admin, "cl-end");
    const end = await grantManualAccess(boss, user.id, 10);
    const { data } = await admin
      .from("subscriptions")
      .select("current_period_end")
      .eq("user_id", user.id)
      .single();
    expect(Date.parse(end)).toBe(Date.parse(data!.current_period_end!));
    expect(Date.parse(end) - Date.now()).toBeGreaterThan(9 * 86_400_000);
    const extended = await grantManualAccess(boss, user.id, 5);
    expect(Date.parse(extended) - Date.parse(end)).toBe(5 * 86_400_000);
  });

  it("maps the database errors: unknown client, non-admin, bad days", async () => {
    await expect(grantManualAccess(boss, crypto.randomUUID(), 5)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const sneaky = await signedInClient(await createUser(admin, "cl-sneak2"));
    const victim = await createUser(admin, "cl-victim2");
    await expect(grantManualAccess(sneaky, victim.id, 5)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("rejects absurd day counts and writes nothing", async () => {
    const user = await createUser(admin, "cl-days");
    for (const days of [0, -3, 9999, 1.5, Number.NaN]) {
      await expect(grantManualAccess(boss, user.id, days)).rejects.toThrow();
    }
    const { data } = await admin.from("subscriptions").select("user_id").eq("user_id", user.id);
    expect(data).toEqual([]);
  });

  it("adds notes and a snooze, and shows them in the detail with the author", async () => {
    const user = await createUser(admin, "cl-notes");
    await addNote(boss, user.id, { kind: "note", body: "Болки в коляното — мина на Начинаещ." });
    await addNote(boss, user.id, { kind: "snooze", days: 7 });
    await addNote(boss, user.id, { kind: "call" });
    await recordMessage(boss, user.id, "x".repeat(3000));
    const detail = await getClientDetail(boss, user.id);
    expect(detail?.notes.map((n) => n.kind)).toEqual(["message", "call", "snooze", "note"]);
    const { data: me } = await admin.from("profiles").select("name").eq("id", bossUser.id).single();
    expect(detail?.notes.every((n) => n.authorName === me!.name)).toBe(true);
    expect(detail?.notes[0]?.body).toHaveLength(2000);
    const { rows } = await listClients(boss, { search: user.email });
    const snoozed = Date.parse(rows[0]!.snoozedUntil!);
    expect(snoozed - Date.now()).toBeGreaterThan(6 * 86_400_000);
    expect(snoozed - Date.now()).toBeLessThan(7 * 86_400_000 + 60_000);
  });

  it("rejects invalid notes and writes nothing", async () => {
    const user = await createUser(admin, "cl-badnote");
    const bad = [
      { kind: "note", body: "   " },
      { kind: "note", body: "x".repeat(2001) },
      { kind: "snooze", days: 0 },
      { kind: "snooze", days: 61 },
      { kind: "snooze", days: Number.NaN },
      { kind: "message", body: "hi" },
      { kind: "bogus" },
      null,
    ];
    for (const raw of bad) await expect(addNote(boss, user.id, raw)).rejects.toThrow();
    const { data } = await admin.from("client_notes").select("id").eq("user_id", user.id);
    expect(data).toEqual([]);
  });

  it("returns null for an unknown client", async () => {
    expect(await getClientDetail(boss, crypto.randomUUID())).toBeNull();
  });

  it("does not let a non-admin read notes, add notes or grant access", async () => {
    const victim = await createUser(admin, "cl-victim");
    const sneaky = await createUser(admin, "cl-sneaky");
    const db = await signedInClient(sneaky);
    await expect(addNote(db, victim.id, { kind: "note", body: "hi" })).rejects.toThrow();
    await expect(grantManualAccess(db, victim.id, 30)).rejects.toThrow();
    await expect(listClients(db)).rejects.toThrow();
    expect(await access(victim.id)).toBe(false);
    const { data } = await admin.from("client_notes").select("id").eq("user_id", victim.id);
    expect(data).toEqual([]);
  });
});

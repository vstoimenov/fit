import { beforeAll, describe, expect, it } from "vitest";
import {
  getClientDetail,
  grantManualAccess,
  listClients,
  revokeManualAccess,
} from "@/server/admin/clients";
import { addNote, recordMessage } from "@/server/admin/notes";
import {
  adminClient,
  createAdminUser,
  createUser,
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

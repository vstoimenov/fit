import { beforeAll, describe, expect, it, vi } from "vitest";
import { SETTING_DEFAULTS } from "@/lib/admin/settings";
import { listAtRisk, sendNudge } from "@/server/admin/risk";
import { getSettings } from "@/server/admin/settings";
import { adminClient, createAdminUser, createUser, grantAccess, type TypedClient } from "./helpers";

let admin: TypedClient;
let boss: TypedClient;
const thresholds = { inactiveDays: 5, minCompletionPct: 50 };

beforeAll(async () => {
  admin = adminClient();
  boss = (await createAdminUser(admin, "risk-admin")).db;
});

const atRisk = async (email: string, userId: string) =>
  (await listAtRisk(boss, thresholds, new Date(), email)).find((r) => r.client.userId === userId);

describe("listAtRisk", () => {
  it("lists a subscriber who has not trained, and drops her after a snooze", async () => {
    const user = await createUser(admin, "risk-idle");
    await admin
      .from("profiles")
      .update({ joined_at: new Date(Date.now() - 10 * 86_400_000).toISOString() })
      .eq("id", user.id);
    await grantAccess(admin, user.id);
    expect((await atRisk(user.email, user.id))?.reasons).toContain("inactive");
    await boss.from("client_notes").insert({
      user_id: user.id,
      kind: "snooze",
      snooze_until: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(await atRisk(user.email, user.id)).toBeUndefined();
  });

  it("does not list a subscriber who trained within the threshold", async () => {
    const user = await createUser(admin, "risk-active");
    await admin
      .from("profiles")
      .update({ joined_at: new Date(Date.now() - 10 * 86_400_000).toISOString() })
      .eq("id", user.id);
    await grantAccess(admin, user.id);
    const { data: free } = await admin.from("workouts").select("id").eq("kind", "free").single();
    await admin.from("workout_completions").insert({ user_id: user.id, workout_id: free!.id });
    const found = await atRisk(user.email, user.id);
    expect(found?.reasons ?? []).not.toContain("inactive");
  });

  it("scans every page of clients, not just the first", async () => {
    const token = `risk-paged-${Math.random().toString(36).slice(2, 8)}`;
    const users = await Promise.all([1, 2, 3].map(() => createUser(admin, token)));
    for (const u of users) {
      await admin
        .from("profiles")
        .update({ joined_at: new Date(Date.now() - 10 * 86_400_000).toISOString() })
        .eq("id", u.id);
      await grantAccess(admin, u.id);
    }
    const found = await listAtRisk(boss, thresholds, new Date(), token, 2);
    expect(found.map((r) => r.client.userId).sort()).toEqual(users.map((u) => u.id).sort());
  });

  it("ignores a lead without access", async () => {
    const lead = await createUser(admin, "risk-lead");
    expect(await atRisk(lead.email, lead.id)).toBeUndefined();
  });

  it("lists a failed payment even without access", async () => {
    const user = await createUser(admin, "risk-pastdue");
    await grantAccess(admin, user.id, "past_due");
    expect((await atRisk(user.email, user.id))?.reasons).toContain("past_due");
  });
});

describe("sendNudge", () => {
  it("renders the template, sends it and records a message note", async () => {
    const user = await createUser(admin, "risk-nudge", { name: "Деси" });
    const send = vi.fn(async () => ({ delivered: true }));
    const result = await sendNudge(boss, { send }, user.id, {
      nudgeSubject: "Хей, {{name}}",
      nudgeBody: "Здравей, {{name}}!",
    });
    expect(result).toEqual({ delivered: true });
    expect(send).toHaveBeenCalledWith({
      to: user.email,
      toName: "Деси",
      subject: "Хей, Деси",
      text: "Здравей, Деси!",
    });
    const { data } = await admin.from("client_notes").select("kind, body").eq("user_id", user.id);
    expect(data).toEqual([{ kind: "message", body: "Хей, Деси\n\nЗдравей, Деси!" }]);
  });

  it("records an undelivered message honestly", async () => {
    const user = await createUser(admin, "risk-nomail", { name: "Ива" });
    await sendNudge(
      boss,
      { send: async () => ({ delivered: false }) },
      user.id,
      SETTING_DEFAULTS.email_templates,
    );
    const { data } = await admin
      .from("client_notes")
      .select("body")
      .eq("user_id", user.id)
      .single();
    expect(data?.body).toMatch(/^\(НЕ Е ИЗПРАТЕНО/);
  });

  it("records nothing and throws for a client that does not exist", async () => {
    const send = vi.fn(async () => ({ delivered: true }));
    await expect(
      sendNudge(boss, { send }, crypto.randomUUID(), SETTING_DEFAULTS.email_templates),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
  it("never emails an admin", async () => {
    const { user } = await createAdminUser(admin, "risk-other-admin");
    const send = vi.fn(async () => ({ delivered: true }));
    await expect(
      sendNudge(boss, { send }, user.id, SETTING_DEFAULTS.email_templates),
    ).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("getSettings", () => {
  it("returns defaults when nothing is stored", async () => {
    await boss.from("settings").delete().eq("key", "risk");
    expect((await getSettings(boss)).risk).toEqual(SETTING_DEFAULTS.risk);
  });

  it("falls back to the default for an invalid stored value and keeps valid ones", async () => {
    await admin
      .from("settings")
      .upsert({ key: "risk", value: { inactiveDays: 0, minCompletionPct: "x" } });
    await admin
      .from("settings")
      .upsert({ key: "payment_provider", value: { provider: "revolut" } });
    const settings = await getSettings(boss);
    expect(settings.risk).toEqual(SETTING_DEFAULTS.risk);
    expect(settings.payment_provider).toEqual({ provider: "revolut" });
    await admin.from("settings").delete().in("key", ["risk", "payment_provider"]);
  });
});

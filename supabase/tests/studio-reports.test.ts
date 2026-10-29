import { describe, expect, it } from "vitest";
import { listClients } from "@/server/admin/clients";
import { getDashboard } from "@/server/admin/dashboard";
import { listAtRisk } from "@/server/admin/risk";
import { sendBroadcast } from "@/server/push/broadcast";
import type { PushTransport } from "@/server/push/send";
import { sendStudioWarnings } from "@/server/studio/warnings";
import { adminClient, createAdminUser, createUser, type TestUser } from "./helpers";
import { sofiaToday, studioCard } from "./studio-helpers";
import { addDays, zonedToUtc } from "@/lib/admin/time";

const admin = adminClient();
/** Today at 12:00 Sofia: inside the daytime window for card nudges. */
const noon = () => new Date(zonedToUtc(sofiaToday(), "12:00"));

async function studioOnly(label: string): Promise<TestUser> {
  const user = await createUser(admin, label, { name: `Зала ${label}` });
  const { error } = await admin.from("profiles").update({ studio_client: true }).eq("id", user.id);
  if (error) throw error;
  return user;
}

async function device(userId: string): Promise<string> {
  const endpoint = `https://fcm.googleapis.com/fcm/send/studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { error } = await admin
    .from("push_subscriptions")
    .insert({ user_id: userId, endpoint, p256dh: "BHxk-p256dh", auth: "authsecret" });
  if (error) throw error;
  return endpoint;
}

/** Records every delivery as endpoint → payload. */
function recorder() {
  const sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
  const transport: PushTransport = async (sub, payload) => {
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  };
  return { sent, transport };
}

describe("online club stays clean", () => {
  it("client stats mark in-person-only clients and the at-risk list leaves them out", async () => {
    const { db } = await createAdminUser(admin, "reports-admin");
    const gym = await studioOnly("reports-gym");
    const online = await createUser(admin, "reports-online");
    const { rows } = await listClients(db, { search: gym.email });
    expect(rows.find((r) => r.userId === gym.id)?.studioOnly).toBe(true);
    const { rows: others } = await listClients(db, { search: online.email });
    expect(others.find((r) => r.userId === online.id)?.studioOnly).toBe(false);

    const risk = await listAtRisk(db, { inactiveDays: 1, minCompletionPct: 100 }, new Date());
    expect(risk.some((r) => r.client.userId === gym.id)).toBe(false);
  });

  it("dashboard registrations leave in-person-only clients out", async () => {
    const { db } = await createAdminUser(admin, "dash-admin");
    const before = await getDashboard(db);
    await studioOnly("dash-gym");
    const between = await getDashboard(db);
    expect(between.registrations.d7).toBe(before.registrations.d7);
    await createUser(admin, "dash-online");
    const after = await getDashboard(db);
    expect(after.registrations.d7).toBe(before.registrations.d7 + 1);
  });

  it("a broadcast skips in-person-only clients", async () => {
    const { user: owner } = await createAdminUser(admin, "bc-admin");
    const gym = await studioOnly("bc-gym");
    const gymPhone = await device(gym.id);
    const member = await createUser(admin, "bc-member");
    const memberPhone = await device(member.id);
    const { sent, transport } = recorder();
    await sendBroadcast(admin, owner.id, { title: "Ново", body: "Текст", url: null }, transport);
    const endpoints = sent.map((s) => s.endpoint);
    expect(endpoints).toContain(memberPhone);
    expect(endpoints).not.toContain(gymPhone);
  });
});

describe("card warnings", () => {
  it("pushes „1 посещение“ once", async () => {
    const gym = await studioOnly("warn-low");
    const phone = await device(gym.id);
    await studioCard(admin, gym.id, { usedBefore: 7 });
    const first = recorder();
    await sendStudioWarnings(admin, first.transport, noon());
    expect(first.sent.find((s) => s.endpoint === phone)?.payload).toMatchObject({
      body: "Остава ти 1 посещение по картата. Поднови я при Аксения.",
      url: "/zala",
    });
    const second = recorder();
    await sendStudioWarnings(admin, second.transport, noon());
    expect(second.sent.some((s) => s.endpoint === phone)).toBe(false);
  });

  it("pushes the end date 3 days ahead, once", async () => {
    const gym = await studioOnly("warn-exp");
    const phone = await device(gym.id);
    const today = sofiaToday();
    const ends = addDays(today, 3);
    await studioCard(admin, gym.id, { startsOn: addDays(today, -20), endsOn: ends });
    const first = recorder();
    const report = await sendStudioWarnings(admin, first.transport, noon());
    expect(report.expiring).toBeGreaterThanOrEqual(1);
    const [, mm, dd] = ends.split("-");
    expect(first.sent.find((s) => s.endpoint === phone)?.payload.body).toBe(
      `Картата ти изтича на ${Number(dd)}.${mm}. Остават ти 8 посещения.`,
    );
    const second = recorder();
    await sendStudioWarnings(admin, second.transport, noon());
    expect(second.sent.some((s) => s.endpoint === phone)).toBe(false);
  });
});

describe("card warnings timing", () => {
  it("stays quiet at night in Sofia and speaks during the day", async () => {
    const gym = await studioOnly("warn-night");
    const phone = await device(gym.id);
    await studioCard(admin, gym.id, { usedBefore: 7 });
    const today = sofiaToday();
    const night = recorder();
    await sendStudioWarnings(admin, night.transport, new Date(zonedToUtc(today, "02:00")));
    expect(night.sent.some((s) => s.endpoint === phone)).toBe(false);
    const day = recorder();
    await sendStudioWarnings(admin, day.transport, new Date(zonedToUtc(today, "10:00")));
    expect(day.sent.some((s) => s.endpoint === phone)).toBe(true);
  });
});

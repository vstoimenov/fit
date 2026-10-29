import { describe, expect, it } from "vitest";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/admin/time";
import { adminClient, anonClient, createUser, signedInClient, type TypedClient } from "./helpers";

/** ISO weekday (1 = Monday) of a calendar date. */
const isoWeekday = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

async function slot(
  admin: TypedClient,
  fields: { weekday: number; start_time?: string; active?: boolean; capacity?: number },
) {
  const { data, error } = await admin
    .from("studio_slots")
    .insert({
      title: "Кръгова тренировка",
      start_time: "18:00",
      capacity: 10,
      ...fields,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function sessionsOf(admin: TypedClient, slotId: string) {
  const { data, error } = await admin
    .from("studio_sessions")
    .select("id, starts_at")
    .eq("slot_id", slotId)
    .order("starts_at");
  if (error) throw error;
  return data;
}

describe("studio schedule", () => {
  it("ensure creates sessions for active slots in Sofia time, once", async () => {
    const admin = adminClient();
    const today = "2026-11-02"; // Monday
    const id = await slot(admin, { weekday: isoWeekday("2026-11-04") });
    for (let i = 0; i < 2; i++) {
      const { error } = await admin.rpc("studio_ensure_sessions", { p_days: 7, p_today: today });
      expect(error).toBeNull();
    }
    const rows = await sessionsOf(admin, id);
    expect(rows.map((r) => new Date(r.starts_at).toISOString())).toEqual([
      zonedToUtc("2026-11-04", "18:00"),
    ]);
  });

  it("keeps 18:00 local on both sides of the DST change", async () => {
    const admin = adminClient();
    // Summer time ends on Sunday 2026-10-25; Thursdays 22.10 and 29.10 straddle it.
    const id = await slot(admin, { weekday: isoWeekday("2026-10-22") });
    await admin.rpc("studio_ensure_sessions", { p_days: 14, p_today: "2026-10-19" });
    const local = (await sessionsOf(admin, id)).map((r) => utcToZoned(r.starts_at));
    expect(local).toEqual([
      { date: "2026-10-22", time: "18:00" },
      { date: "2026-10-29", time: "18:00" },
    ]);
  });

  it("inactive slots produce nothing", async () => {
    const admin = adminClient();
    const id = await slot(admin, { weekday: 3, active: false });
    await admin.rpc("studio_ensure_sessions", { p_days: 14, p_today: "2026-11-02" });
    expect(await sessionsOf(admin, id)).toEqual([]);
  });

  it("anon reads the schedule with counts but no bookings, and nobody writes directly", async () => {
    const admin = adminClient();
    const today = utcToZoned(new Date().toISOString()).date;
    const id = await slot(admin, { weekday: isoWeekday(addDays(today, 2)), capacity: 5 });
    await admin.rpc("studio_ensure_sessions", { p_days: 7 });
    const [session] = await sessionsOf(admin, id);
    const member = await createUser(admin, "studio-member");
    await admin.from("studio_bookings").insert({
      session_id: session!.id,
      user_id: member.id,
      source: "client",
    });

    const anon = anonClient();
    const { data: schedule, error } = await anon.rpc("studio_schedule", {
      p_from: new Date().toISOString(),
      p_to: new Date(Date.now() + 8 * 86_400_000).toISOString(),
    });
    expect(error).toBeNull();
    const row = schedule!.find((r) => r.id === session!.id);
    expect(row).toMatchObject({ capacity: 5, booked: 1, cancelled: false });
    expect((await anon.from("studio_bookings").select("id")).data ?? []).toEqual([]);

    const db = await signedInClient(member);
    const insertBooking = await db
      .from("studio_bookings")
      .insert({ session_id: session!.id, user_id: member.id, source: "client" });
    expect(insertBooking.error).not.toBeNull();
    const insertCard = await db.from("studio_cards").insert({
      user_id: member.id,
      kind: "card8",
      visits: 8,
      starts_on: today,
      ends_on: addDays(today, 27),
    });
    expect(insertCard.error).not.toBeNull();
  });

  it("a client sees only her own cards and bookings", async () => {
    const admin = adminClient();
    const a = await createUser(admin, "studio-a");
    const b = await createUser(admin, "studio-b");
    for (const u of [a, b]) {
      const { error } = await admin.from("studio_cards").insert({
        user_id: u.id,
        kind: "card8",
        visits: 8,
        starts_on: "2026-11-03",
        ends_on: "2026-11-30",
      });
      if (error) throw error;
    }
    const db = await signedInClient(a);
    const { data: cards } = await db.from("studio_card_status").select("user_id, remaining");
    expect(cards).toEqual([{ user_id: a.id, remaining: 8 }]);
  });
});

import { describe, expect, it } from "vitest";
import { addDays, zonedToUtc } from "@/lib/admin/time";
import { adminClient, createAdminUser, createUser, signedInClient } from "./helpers";
import { hours, sofiaToday, studioCard, studioSession } from "./studio-helpers";

async function setup(label: string) {
  const admin = adminClient();
  const { db: trainer } = await createAdminUser(admin, `${label}-admin`);
  return { admin, trainer };
}

async function booked(admin: ReturnType<typeof adminClient>, sessionId: string, label: string) {
  const user = await createUser(admin, label);
  const db = await signedInClient(user);
  const { data, error } = await db.rpc("studio_book", { p_session_id: sessionId });
  if (error) throw error;
  return { user, bookingId: (data as { booking_id: string }).booking_id };
}

describe("attendance", () => {
  it("the trainer ticks and unticks who came", async () => {
    const { admin, trainer } = await setup("att-tick");
    const session = await studioSession(admin, hours(1));
    const { bookingId } = await booked(admin, session, "att-tick-client");
    expect(
      (await trainer.rpc("studio_set_attended", { p_booking_id: bookingId, p_attended: true }))
        .error,
    ).toBeNull();
    const { data: on } = await admin
      .from("studio_bookings")
      .select("attended_at")
      .eq("id", bookingId)
      .single();
    expect(on?.attended_at).not.toBeNull();
    await trainer.rpc("studio_set_attended", { p_booking_id: bookingId, p_attended: false });
    const { data: off } = await admin
      .from("studio_bookings")
      .select("attended_at")
      .eq("id", bookingId)
      .single();
    expect(off?.attended_at).toBeNull();
  });

  it("a client cannot tick herself", async () => {
    const admin = adminClient();
    const session = await studioSession(admin, hours(1));
    const user = await createUser(admin, "att-self");
    const db = await signedInClient(user);
    const { data } = await db.rpc("studio_book", { p_session_id: session });
    const id = (data as { booking_id: string }).booking_id;
    expect(
      (await db.rpc("studio_set_attended", { p_booking_id: id, p_attended: true })).error?.code,
    ).toBe("42501");
  });

  it("the day board lists the day's trainings with ticks, card and cash", async () => {
    const { listDayBoard } = await import("@/server/studio/today");
    const { admin, trainer } = await setup("att-board");
    const day = addDays(sofiaToday(), 9);
    const session = await studioSession(admin, zonedToUtc(day, "07:05"));
    const a = await booked(admin, session, "att-board-a");
    const b = await booked(admin, session, "att-board-b");
    await studioCard(admin, b.user.id, { startsOn: day, endsOn: addDays(day, 27) });
    await trainer.rpc("studio_set_attended", { p_booking_id: a.bookingId, p_attended: true });
    const board = await listDayBoard(trainer, day);
    const card = board.find((t) => t.session.id === session)!;
    expect(card.entries.find((e) => e.bookingId === a.bookingId)).toMatchObject({
      attended: true,
      card: null,
    });
    expect(card.entries.find((e) => e.bookingId === b.bookingId)?.attended).toBe(false);
  });

  it("the board opens on the next day with trainings when the asked day has none", async () => {
    const { boardDate } = await import("@/server/studio/today");
    const { admin, trainer } = await setup("att-next");
    // Two months out: past the weekly slots' 31-day window and every other test's sessions.
    const empty = addDays(sofiaToday(), 60);
    const next = addDays(empty, 1);
    await studioSession(admin, zonedToUtc(next, "09:00"));
    expect(await boardDate(trainer, empty)).toBe(next);
  });

  it("door search finds any client by name or phone", async () => {
    const { searchClients } = await import("@/server/studio/today");
    const { admin, trainer } = await setup("att-search");
    const user = await createUser(admin, "att-search-client");
    const phone = `0899${String(Date.now()).slice(-6)}`;
    await admin.from("profiles").update({ name: "Росица Търсена", phone }).eq("id", user.id);
    expect((await searchClients(trainer, "росица търс")).map((c) => c.userId)).toContain(user.id);
    expect((await searchClients(trainer, phone.slice(-6))).map((c) => c.userId)).toContain(user.id);
    expect(await searchClients(trainer, "р")).toEqual([]);
  });
});

describe("door", () => {
  it("adds a walk-in beyond the limit and ticks her as came", async () => {
    const { addAtDoor } = await import("@/server/studio/today");
    const { admin, trainer } = await setup("att-door");
    const session = await studioSession(admin, hours(-0.2), 1);
    await admin.from("studio_bookings").insert({
      session_id: session,
      user_id: (await createUser(admin, "att-door-first")).id,
      source: "admin",
    });
    const walkIn = await createUser(admin, "att-door-walkin");
    expect(await addAtDoor(trainer, session, walkIn.id)).toEqual({ ok: true, overLimit: true });
    const { data } = await admin
      .from("studio_bookings")
      .select("attended_at, over_limit")
      .eq("session_id", session)
      .eq("user_id", walkIn.id)
      .single();
    expect(data?.attended_at).not.toBeNull();
    expect(data?.over_limit).toBe(true);
  });
});

describe("door after the training", () => {
  it("still adds on the same day once the training is over, not on a later day", async () => {
    const { addAtDoor } = await import("@/server/studio/today");
    const { admin, trainer } = await setup("att-late");
    const insert = async (startsAt: string) => {
      const { data, error } = await admin
        .from("studio_sessions")
        .insert({ starts_at: startsAt, duration_min: 15, title: "Ранна", capacity: 5 })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    };
    // 00:00–00:15 today (Sofia): over by the time the test runs (except in its first 15 minutes).
    const today = await insert(zonedToUtc(sofiaToday(), "00:00"));
    const yesterday = await insert(zonedToUtc(addDays(sofiaToday(), -1), "18:00"));
    const a = await createUser(admin, "att-late-a");
    expect((await addAtDoor(trainer, today, a.id)).ok).toBe(true);
    expect(await addAtDoor(trainer, yesterday, a.id)).toEqual({
      ok: false,
      message: "Тренировката е от минал ден.",
    });
  });
});

import { describe, expect, it } from "vitest";
import { addDays, zonedToUtc } from "@/lib/admin/time";
import { adminClient, createUser, signedInClient } from "./helpers";
import { hours, remaining, sofiaToday, studioCard, studioSession } from "./studio-helpers";

async function client(label: string) {
  const admin = adminClient();
  const user = await createUser(admin, label);
  return { admin, user, db: await signedInClient(user) };
}

describe("studio booking", () => {
  it("booking with a valid card takes one visit", async () => {
    const { admin, user, db } = await client("book-card");
    const card = await studioCard(admin, user.id);
    const session = await studioSession(admin, hours(30));
    const { data, error } = await db.rpc("studio_book", { p_session_id: session });
    expect(error).toBeNull();
    expect(data).toMatchObject({ card_id: card });
    expect(await remaining(admin, card)).toBe(7);
    const { data: profile } = await admin
      .from("profiles")
      .select("studio_client")
      .eq("id", user.id)
      .single();
    expect(profile?.studio_client).toBe(true);
  });

  it("booking without a card is a drop-in", async () => {
    const { admin, db } = await client("book-dropin");
    const session = await studioSession(admin, hours(30));
    const { data, error } = await db.rpc("studio_book", { p_session_id: session });
    expect(error).toBeNull();
    expect(data).toMatchObject({ card_id: null });
  });

  it("expired, voided and used-up cards are skipped", async () => {
    const { admin, user, db } = await client("book-skip");
    const today = sofiaToday();
    await studioCard(admin, user.id, { startsOn: addDays(today, -30), endsOn: addDays(today, -1) });
    await studioCard(admin, user.id, { voided: true });
    const empty = await studioCard(admin, user.id);
    await admin
      .from("studio_card_adjustments")
      .insert({ card_id: empty, delta: -8, reason: "тест" });
    const session = await studioSession(admin, hours(30));
    const { data } = await db.rpc("studio_book", { p_session_id: session });
    expect(data).toMatchObject({ card_id: null });
  });

  it("the card ending first is used", async () => {
    const { admin, user, db } = await client("book-first");
    const today = sofiaToday();
    await studioCard(admin, user.id, { kind: "card12", startsOn: today });
    const sooner = await studioCard(admin, user.id, { startsOn: addDays(today, -3) });
    const session = await studioSession(admin, hours(30));
    const { data } = await db.rpc("studio_book", { p_session_id: session });
    expect(data).toMatchObject({ card_id: sooner });
  });

  it("judges the card's last day in Sofia time", async () => {
    const { admin, user, db } = await client("book-lastday");
    const today = sofiaToday();
    const last = addDays(today, 2);
    const card = await studioCard(admin, user.id, { startsOn: today, endsOn: last });
    const late = await studioSession(admin, zonedToUtc(last, "23:30"));
    const after = await studioSession(admin, zonedToUtc(addDays(last, 1), "00:30"));
    expect((await db.rpc("studio_book", { p_session_id: late })).data).toMatchObject({
      card_id: card,
    });
    expect((await db.rpc("studio_book", { p_session_id: after })).data).toMatchObject({
      card_id: null,
    });
  });

  it("refuses full, double, started, not-yet-open and cancelled trainings", async () => {
    const { admin, db } = await client("book-refuse");
    const other = await client("book-refuse-other");
    const full = await studioSession(admin, hours(30), 1);
    await other.db.rpc("studio_book", { p_session_id: full });
    expect((await db.rpc("studio_book", { p_session_id: full })).error?.message).toContain("full");

    const twice = await studioSession(admin, hours(30));
    await db.rpc("studio_book", { p_session_id: twice });
    expect((await db.rpc("studio_book", { p_session_id: twice })).error?.message).toContain(
      "already booked",
    );

    const started = await studioSession(admin, hours(-0.5));
    expect((await db.rpc("studio_book", { p_session_id: started })).error?.message).toContain(
      "started",
    );

    const far = await studioSession(admin, hours(32 * 24));
    expect((await db.rpc("studio_book", { p_session_id: far })).error?.message).toContain(
      "not open",
    );

    const cancelled = await studioSession(admin, hours(30));
    await admin
      .from("studio_sessions")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", cancelled);
    expect((await db.rpc("studio_book", { p_session_id: cancelled })).error?.message).toContain(
      "session cancelled",
    );
  });

  it("two clients racing for the last spot: exactly one gets it", async () => {
    const admin = adminClient();
    const session = await studioSession(admin, hours(30), 1);
    const [a, b] = await Promise.all([client("race-a"), client("race-b")]);
    const results = await Promise.all([
      a.db.rpc("studio_book", { p_session_id: session }),
      b.db.rpc("studio_book", { p_session_id: session }),
    ]);
    const errors = results.map((r) => r.error?.message ?? null);
    expect(errors.filter((e) => e === null)).toHaveLength(1);
    expect(errors.find((e) => e !== null)).toContain("full");
    const { count } = await admin
      .from("studio_bookings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session)
      .eq("status", "booked");
    expect(count).toBe(1);
  });

  it("cancelling 6+ hours ahead returns the visit; inside 6 hours it is refused", async () => {
    const { admin, user, db } = await client("cancel");
    const card = await studioCard(admin, user.id);
    const early = await studioSession(admin, hours(7));
    const late = await studioSession(admin, hours(5));
    const { data: b1 } = await db.rpc("studio_book", { p_session_id: early });
    const { data: b2 } = await db.rpc("studio_book", { p_session_id: late });
    expect(await remaining(admin, card)).toBe(6);

    const id1 = (b1 as { booking_id: string }).booking_id;
    const id2 = (b2 as { booking_id: string }).booking_id;
    expect((await db.rpc("studio_cancel", { p_booking_id: id1 })).error).toBeNull();
    expect(await remaining(admin, card)).toBe(7);
    expect((await db.rpc("studio_cancel", { p_booking_id: id2 })).error?.message).toContain(
      "too late",
    );
    expect(await remaining(admin, card)).toBe(7);

    // Booking again after a cancel works.
    expect((await db.rpc("studio_book", { p_session_id: early })).error).toBeNull();
  });

  it("cannot cancel someone else's booking", async () => {
    const { admin, db } = await client("cancel-own");
    const other = await client("cancel-other");
    const session = await studioSession(admin, hours(30));
    const { data } = await other.db.rpc("studio_book", { p_session_id: session });
    const id = (data as { booking_id: string }).booking_id;
    expect((await db.rpc("studio_cancel", { p_booking_id: id })).error).not.toBeNull();
    const { data: row } = await admin
      .from("studio_bookings")
      .select("status")
      .eq("id", id)
      .single();
    expect(row?.status).toBe("booked");
  });
});

describe("loadMyStudio", () => {
  it("shows her current card, upcoming bookings with cancel state, and past visits", async () => {
    const { loadMyStudio } = await import("@/server/studio/booking");
    const { admin, user, db } = await client("my-studio");
    const card = await studioCard(admin, user.id, { usedBefore: 2 });
    const soon = await studioSession(admin, hours(3));
    const later = await studioSession(admin, hours(30));
    await db.rpc("studio_book", { p_session_id: soon });
    await db.rpc("studio_book", { p_session_id: later });
    const past = await studioSession(admin, hours(-48));
    await admin
      .from("studio_bookings")
      .insert({ session_id: past, user_id: user.id, card_id: card, source: "admin" });

    const my = await loadMyStudio(db, user.id);
    expect(my.current).toMatchObject({ id: card, kind: "card8", usedBefore: 2, remaining: 3 });
    expect(my.upcoming.map((b) => [b.sessionId, b.canCancel])).toEqual([
      [soon, false],
      [later, true],
    ]);
    expect(my.past.map((b) => b.sessionId)).toEqual([past]);
  });
});

describe("cancelled trainings", () => {
  it("she sees that a training she was booked for was cancelled", async () => {
    const { loadMyStudio } = await import("@/server/studio/booking");
    const { createAdminUser } = await import("./helpers");
    const { admin, user, db } = await client("cancelled-notice");
    const { db: trainer } = await createAdminUser(admin, "cancelled-notice-admin");
    const session = await studioSession(admin, hours(30));
    await db.rpc("studio_book", { p_session_id: session });
    await trainer.rpc("studio_cancel_session", { p_session_id: session });
    const my = await loadMyStudio(db, user.id);
    expect(my.upcoming).toEqual([]);
    expect(my.cancelled.map((b) => b.sessionId)).toEqual([session]);
  });
});

describe("booking window", () => {
  it("a training 20 days ahead can be booked (the month view is open)", async () => {
    const { admin, db } = await client("book-month");
    const session = await studioSession(admin, hours(20 * 24));
    expect((await db.rpc("studio_book", { p_session_id: session })).error).toBeNull();
  });
});

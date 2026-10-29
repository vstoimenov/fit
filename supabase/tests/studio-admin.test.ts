import { describe, expect, it } from "vitest";
import { addDays, utcToZoned } from "@/lib/admin/time";
import { adminClient, createAdminUser, createUser, signedInClient } from "./helpers";
import { hours, remaining, sofiaToday, studioCard, studioSession } from "./studio-helpers";

async function setup(label: string) {
  const admin = adminClient();
  const { db: trainer } = await createAdminUser(admin, `${label}-admin`);
  return { admin, trainer };
}

const isoWeekday = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

describe("studio admin", () => {
  it("adds a walk-in beyond the limit and uses her card", async () => {
    const { admin, trainer } = await setup("add");
    const session = await studioSession(admin, hours(2), 1);
    const first = await createUser(admin, "add-first");
    await (await signedInClient(first)).rpc("studio_book", { p_session_id: session });
    const walkIn = await createUser(admin, "add-walkin");
    const card = await studioCard(admin, walkIn.id);
    const { data, error } = await trainer.rpc("studio_admin_add", {
      p_session_id: session,
      p_user_id: walkIn.id,
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ card_id: card, over_limit: true });
    expect(await remaining(admin, card)).toBe(7);
    expect(
      (await trainer.rpc("studio_admin_add", { p_session_id: session, p_user_id: walkIn.id })).error
        ?.message,
    ).toContain("already booked");
  });

  it("removing a booking inside 6 hours still returns the visit", async () => {
    const { admin, trainer } = await setup("remove");
    const user = await createUser(admin, "remove-client");
    const card = await studioCard(admin, user.id);
    const session = await studioSession(admin, hours(2));
    const { data } = await (
      await signedInClient(user)
    ).rpc("studio_book", {
      p_session_id: session,
    });
    const id = (data as { booking_id: string }).booking_id;
    expect((await trainer.rpc("studio_admin_remove", { p_booking_id: id })).error).toBeNull();
    expect(await remaining(admin, card)).toBe(8);
  });

  it("cancelling a training returns every visit and closes it for booking", async () => {
    const { admin, trainer } = await setup("cancel-session");
    const session = await studioSession(admin, hours(30));
    const withCard = await createUser(admin, "cs-card");
    const card = await studioCard(admin, withCard.id);
    const dropIn = await createUser(admin, "cs-dropin");
    await (await signedInClient(withCard)).rpc("studio_book", { p_session_id: session });
    await (await signedInClient(dropIn)).rpc("studio_book", { p_session_id: session });
    const { data, error } = await trainer.rpc("studio_cancel_session", { p_session_id: session });
    expect(error).toBeNull();
    expect([...(data as string[])].sort()).toEqual([withCard.id, dropIn.id].sort());
    expect(await remaining(admin, card)).toBe(8);
    const late = await signedInClient(await createUser(admin, "cs-late"));
    expect((await late.rpc("studio_book", { p_session_id: session })).error?.message).toContain(
      "session cancelled",
    );
  });

  it("editing a slot replaces future empty trainings and keeps booked ones", async () => {
    const { admin, trainer } = await setup("slot-edit");
    const today = sofiaToday();
    const d1 = addDays(today, 2);
    const { data: slot } = await trainer
      .from("studio_slots")
      .insert({ weekday: isoWeekday(d1), start_time: "18:00", title: "Сутрешна", capacity: 8 })
      .select("id")
      .single();
    await admin.rpc("studio_ensure_sessions", { p_days: 14 });
    const { data: before } = await admin
      .from("studio_sessions")
      .select("id, starts_at")
      .eq("slot_id", slot!.id)
      .order("starts_at");
    expect(before).toHaveLength(2);
    const client = await createUser(admin, "slot-client");
    await (await signedInClient(client)).rpc("studio_book", { p_session_id: before![0]!.id });

    await trainer.from("studio_slots").update({ start_time: "19:00" }).eq("id", slot!.id);
    expect(
      (await trainer.rpc("studio_reset_slot_sessions", { p_slot_id: slot!.id })).error,
    ).toBeNull();
    await admin.rpc("studio_ensure_sessions", { p_days: 14 });
    const { data: after } = await admin
      .from("studio_sessions")
      .select("starts_at")
      .eq("slot_id", slot!.id)
      .order("starts_at");
    expect(after!.map((r) => utcToZoned(r.starts_at).time)).toEqual(["18:00", "19:00"]);
  });

  it("a client cannot call the admin functions", async () => {
    const admin = adminClient();
    const user = await createUser(admin, "admin-guard");
    const db = await signedInClient(user);
    const session = await studioSession(admin, hours(30));
    const results = await Promise.all([
      db.rpc("studio_admin_add", { p_session_id: session, p_user_id: user.id }),
      db.rpc("studio_cancel_session", { p_session_id: session }),
      db.rpc("studio_reset_slot_sessions", { p_slot_id: session }),
    ]);
    for (const { error } of results) expect(error?.code).toBe("42501");
    const { data } = await db.rpc("studio_book", { p_session_id: session });
    const id = (data as { booking_id: string }).booking_id;
    expect((await db.rpc("studio_admin_remove", { p_booking_id: id })).error?.code).toBe("42501");
  });
});

describe("studio admin (server)", () => {
  it("saveStudioSlot validates, saves and creates the coming trainings; the roster shows who comes", async () => {
    const { saveStudioSlot, listSessionRoster, adminAddBooking } =
      await import("@/server/studio/admin");
    const { admin, trainer } = await setup("srv-slot");
    const bad = await saveStudioSlot(trainer, admin, null, {
      weekday: 9,
      startTime: "18:00",
      durationMin: 60,
      title: "Кръгова",
      capacity: 10,
      active: true,
    });
    expect(bad.ok).toBe(false);

    const day = addDays(sofiaToday(), 3);
    const ok = await saveStudioSlot(trainer, admin, null, {
      weekday: isoWeekday(day),
      startTime: "07:15",
      durationMin: 45,
      title: "Ранна тренировка",
      capacity: 6,
      active: true,
    });
    expect(ok).toMatchObject({ ok: true });
    const { data: sessions } = await admin
      .from("studio_sessions")
      .select("id, starts_at")
      .eq("slot_id", (ok as { id: string }).id)
      .order("starts_at");
    expect(utcToZoned(sessions![0]!.starts_at)).toEqual({ date: day, time: "07:15" });

    const client = await createUser(admin, "srv-roster");
    await admin.from("profiles").update({ name: "Мария", phone: "0888000111" }).eq("id", client.id);
    await studioCard(admin, client.id);
    expect(await adminAddBooking(trainer, sessions![0]!.id, client.id)).toEqual({
      ok: true,
      overLimit: false,
    });
    const roster = await listSessionRoster(trainer, sessions![0]!.id);
    expect(roster.session).toMatchObject({ capacity: 6, booked: 1 });
    expect(roster.entries).toEqual([
      expect.objectContaining({
        userId: client.id,
        name: "Мария",
        phone: "0888000111",
        card: { kind: "card8", remaining: 7 },
        overLimit: false,
        source: "admin",
      }),
    ]);
  });
});

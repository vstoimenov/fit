import "server-only";

import { z } from "zod";
import { cancelNotice } from "@/lib/studio/format";
import type { CardKind } from "@/lib/studio/rules";
import type { TypedClient } from "@/server/db/types";
import { sendToUsers, type PushTransport } from "@/server/push/send";
import { studioErrorMessage } from "./errors";
import { ensureStudioSessions, type StudioSession } from "./schedule";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

/** „График“: one weekly training. */
export const slotSchema = z.object({
  weekday: z.coerce.number().int().min(1, "Избери ден").max(7, "Избери ден"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Избери час"),
  durationMin: z.coerce.number().int().min(15, "Поне 15 минути").max(180, "До 180 минути"),
  title: z.string().trim().min(2, "Нужно е заглавие").max(80, "До 80 знака"),
  capacity: z.coerce.number().int().min(1, "Поне 1 място").max(100, "До 100 места"),
  active: z.boolean(),
});

export interface StudioSlot {
  id: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  title: string;
  capacity: number;
  active: boolean;
}

/**
 * Saves a slot and refreshes the coming trainings: on an edit, future trainings nobody booked are
 * recreated with the new values; booked ones keep theirs. `service` materialises the sessions.
 */
export async function saveStudioSlot(
  db: TypedClient,
  service: TypedClient,
  id: string | null,
  raw: unknown,
): Promise<Result<{ id: string }>> {
  const parsed = slotSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const v = parsed.data;
  const row = {
    weekday: v.weekday,
    start_time: v.startTime,
    duration_min: v.durationMin,
    title: v.title,
    capacity: v.capacity,
    active: v.active,
  };
  const saved = id
    ? await db.from("studio_slots").update(row).eq("id", id).select("id").single()
    : await db.from("studio_slots").insert(row).select("id").single();
  if (saved.error) throw new Error(`save studio slot failed: ${saved.error.message}`);
  if (id) {
    const { error } = await db.rpc("studio_reset_slot_sessions", { p_slot_id: id });
    if (error) throw new Error(`reset slot sessions failed: ${error.message}`);
  }
  await ensureStudioSessions(service);
  return { ok: true, id: saved.data.id };
}

export async function listStudioSlots(db: TypedClient): Promise<StudioSlot[]> {
  const { data, error } = await db
    .from("studio_slots")
    .select("id, weekday, start_time, duration_min, title, capacity, active")
    .order("weekday")
    .order("start_time");
  if (error) throw new Error(`list studio slots failed: ${error.message}`);
  return data.map((r) => ({
    id: r.id,
    weekday: r.weekday,
    startTime: r.start_time.slice(0, 5),
    durationMin: r.duration_min,
    title: r.title,
    capacity: r.capacity,
    active: r.active,
  }));
}

export interface RosterEntry {
  bookingId: string;
  userId: string;
  name: string;
  phone: string | null;
  card: { kind: CardKind; remaining: number } | null;
  overLimit: boolean;
  source: "client" | "admin";
  /** Ticked „Дошла“ on the day. */
  attended: boolean;
}

export async function listSessionRoster(
  db: TypedClient,
  sessionId: string,
): Promise<{ session: StudioSession; entries: RosterEntry[] }> {
  const sessionRes = await db
    .from("studio_sessions")
    .select("id, title, starts_at, duration_min, capacity, cancelled_at")
    .eq("id", sessionId)
    .single();
  if (sessionRes.error) throw new Error(`load studio session failed: ${sessionRes.error.message}`);
  const cancelledAt = sessionRes.data.cancelled_at;
  // A cancelled training keeps the list of who was booked when it was called off: she may call them.
  let bookingsQuery = db
    .from("studio_bookings")
    .select(
      "id, user_id, card_id, over_limit, source, attended_at, created_at, profiles!studio_bookings_user_id_fkey(name, phone)",
    )
    .eq("session_id", sessionId)
    .order("created_at");
  bookingsQuery = cancelledAt
    ? bookingsQuery.eq("status", "cancelled").eq("cancelled_at", cancelledAt)
    : bookingsQuery.eq("status", "booked");
  const bookingsRes = await bookingsQuery;
  if (bookingsRes.error) throw new Error(`load roster failed: ${bookingsRes.error.message}`);
  const cardIds = bookingsRes.data.flatMap((b) => (b.card_id ? [b.card_id] : []));
  const cards = new Map<string, { kind: CardKind; remaining: number }>();
  if (cardIds.length > 0) {
    const { data, error } = await db
      .from("studio_card_status")
      .select("id, kind, remaining")
      .in("id", cardIds);
    if (error) throw new Error(`load roster cards failed: ${error.message}`);
    for (const c of data) cards.set(c.id!, { kind: c.kind as CardKind, remaining: c.remaining! });
  }
  const s = sessionRes.data;
  const booked = cancelledAt ? 0 : bookingsRes.data.length;
  return {
    session: {
      id: s.id,
      title: s.title,
      startsAt: s.starts_at,
      durationMin: s.duration_min,
      capacity: s.capacity,
      booked,
      spotsLeft: Math.max(s.capacity - booked, 0),
      cancelled: s.cancelled_at !== null,
    },
    entries: bookingsRes.data.map((b) => ({
      bookingId: b.id,
      userId: b.user_id,
      name: b.profiles?.name ?? "",
      phone: b.profiles?.phone ?? null,
      card: b.card_id ? (cards.get(b.card_id) ?? null) : null,
      overLimit: b.over_limit,
      source: b.source as "client" | "admin",
      attended: b.attended_at !== null,
    })),
  };
}

export async function adminAddBooking(
  db: TypedClient,
  sessionId: string,
  userId: string,
): Promise<Result<{ overLimit: boolean }>> {
  const { data, error } = await db.rpc("studio_admin_add", {
    p_session_id: sessionId,
    p_user_id: userId,
  });
  if (error) return { ok: false, message: studioErrorMessage(error.message) };
  return { ok: true, overLimit: (data as { over_limit: boolean }).over_limit };
}

export async function adminRemoveBooking(db: TypedClient, bookingId: string): Promise<Result> {
  const { error } = await db.rpc("studio_admin_remove", { p_booking_id: bookingId });
  if (error) return { ok: false, message: studioErrorMessage(error.message) };
  return { ok: true };
}

/** Cancels the training, returns every visit, and pushes the news to whoever was booked. */
export async function cancelStudioSession(
  db: TypedClient,
  service: TypedClient,
  sessionId: string,
  transport: PushTransport | null,
): Promise<{ notified: number }> {
  const { data: session, error: loadError } = await db
    .from("studio_sessions")
    .select("starts_at")
    .eq("id", sessionId)
    .single();
  if (loadError) throw new Error(`load studio session failed: ${loadError.message}`);
  const { data: users, error } = await db.rpc("studio_cancel_session", {
    p_session_id: sessionId,
  });
  if (error) throw new Error(`cancel studio session failed: ${error.message}`);
  if (!transport || users.length === 0) return { notified: 0 };
  const report = await sendToUsers(
    service,
    users,
    {
      title: "Отменена тренировка",
      body: cancelNotice(session.starts_at),
      url: "/zala",
      tag: `studio-cancel-${sessionId}`,
    },
    transport,
  );
  return { notified: report.users };
}

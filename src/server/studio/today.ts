import "server-only";

import { addDays, zonedToUtc } from "@/lib/admin/time";
import { BOOKING_DAYS } from "@/lib/studio/rules";
import type { TypedClient } from "@/server/db/types";
import { adminAddBooking, listSessionRoster, type RosterEntry } from "./admin";
import { studioErrorMessage } from "./errors";
import type { StudioSession } from "./schedule";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

/** Start of a Sofia calendar day as an instant. */
const dayStart = (date: string) => zonedToUtc(date, "00:00");

/** The day „Днес“ opens on: `from` if it has a training, else the next day that does (within a month). */
export async function boardDate(db: TypedClient, from: string): Promise<string> {
  const { data, error } = await db
    .from("studio_sessions")
    .select("starts_at")
    .gte("starts_at", dayStart(from))
    .lt("starts_at", dayStart(addDays(from, BOOKING_DAYS)))
    .is("cancelled_at", null)
    .order("starts_at")
    .limit(1);
  if (error) throw new Error(`find next training day failed: ${error.message}`);
  if (!data[0]) return from;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(
    new Date(data[0].starts_at),
  );
}

/** Every training of a Sofia day with its list of who booked and who came (admin RLS). */
export async function listDayBoard(
  db: TypedClient,
  date: string,
): Promise<{ session: StudioSession; entries: RosterEntry[] }[]> {
  const { data, error } = await db
    .from("studio_sessions")
    .select("id")
    .gte("starts_at", dayStart(date))
    .lt("starts_at", dayStart(addDays(date, 1)))
    .order("starts_at");
  if (error) throw new Error(`load day trainings failed: ${error.message}`);
  return Promise.all(data.map((s) => listSessionRoster(db, s.id)));
}

export async function setAttended(
  db: TypedClient,
  bookingId: string,
  attended: boolean,
): Promise<Result> {
  const { error } = await db.rpc("studio_set_attended", {
    p_booking_id: bookingId,
    p_attended: attended,
  });
  if (error) return { ok: false, message: studioErrorMessage(error.message) };
  return { ok: true };
}

/** „+ На вратата“: booked for the training (over the limit if need be) and ticked at once. */
export async function addAtDoor(
  db: TypedClient,
  sessionId: string,
  userId: string,
): Promise<Result<{ overLimit: boolean }>> {
  const added = await adminAddBooking(db, sessionId, userId);
  if (!added.ok) return added;
  const { data, error } = await db
    .from("studio_bookings")
    .select("id")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .eq("status", "booked")
    .single();
  if (error) throw new Error(`find door booking failed: ${error.message}`);
  const ticked = await setAttended(db, data.id, true);
  if (!ticked.ok) return ticked;
  return { ok: true, overLimit: added.overLimit };
}

export interface ClientHit {
  userId: string;
  name: string;
  phone: string | null;
}

/** Any client (gym or online) by name or phone; at least 2 characters, up to 10 hits. */
export async function searchClients(db: TypedClient, raw: string): Promise<ClientHit[]> {
  // Characters that would break PostgREST's or() filter or act as wildcards are dropped.
  const q = raw.replace(/[,()*%_\\]/g, " ").trim();
  if (q.length < 2) return [];
  const { data, error } = await db
    .from("profiles")
    .select("id, name, phone")
    .eq("role", "client")
    .or(`name.ilike.*${q}*,phone.ilike.*${q}*`)
    .order("name")
    .limit(10);
  if (error) throw new Error(`search clients failed: ${error.message}`);
  return data.map((p) => ({ userId: p.id, name: p.name, phone: p.phone }));
}

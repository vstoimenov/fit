import "server-only";

import { utcToZoned } from "@/lib/admin/time";
import { canCancel, type CardKind } from "@/lib/studio/rules";
import type { TypedClient } from "@/server/db/types";
import { studioErrorMessage } from "./errors";

export interface StudioCard {
  id: string;
  kind: CardKind;
  visits: number;
  startsOn: string;
  endsOn: string;
  usedBefore: number;
  adjusted: number;
  booked: number;
  remaining: number;
  voided: boolean;
  createdAt: string;
}

export interface MyBooking {
  id: string;
  sessionId: string;
  title: string;
  startsAt: string;
  cardId: string | null;
  canCancel: boolean;
}

export interface CardAdjustment {
  cardId: string;
  delta: number;
  reason: string;
  createdAt: string;
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

export const CARD_COLUMNS =
  "id, user_id, kind, visits, starts_on, ends_on, used_before, adjusted, booked, remaining, voided_at, created_at";

type CardRow = {
  id: string | null;
  kind: string | null;
  visits: number | null;
  starts_on: string | null;
  ends_on: string | null;
  used_before: number | null;
  adjusted: number | null;
  booked: number | null;
  remaining: number | null;
  voided_at: string | null;
  created_at: string | null;
};

/** View columns are nullable in the generated types; the view never yields nulls for these. */
export const toCard = (r: CardRow): StudioCard => ({
  id: r.id!,
  kind: r.kind as CardKind,
  visits: r.visits!,
  startsOn: r.starts_on!,
  endsOn: r.ends_on!,
  usedBefore: r.used_before!,
  adjusted: r.adjusted!,
  booked: r.booked!,
  remaining: r.remaining!,
  voided: r.voided_at !== null,
  createdAt: r.created_at!,
});

/** The card a booking today would use, else the newest one she has (so an ended card still shows). */
export function currentCard(cards: StudioCard[], today: string): StudioCard | null {
  const live = cards
    .filter((c) => !c.voided && c.startsOn <= today && today <= c.endsOn && c.remaining > 0)
    .sort((a, b) => a.endsOn.localeCompare(b.endsOn) || a.createdAt.localeCompare(b.createdAt));
  if (live[0]) return live[0];
  return (
    cards.filter((c) => !c.voided).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

/** Books with her own session (the RPC reads auth.uid()). */
export async function bookStudioSession(
  db: TypedClient,
  sessionId: string,
): Promise<Result<{ cardId: string | null }>> {
  const { data, error } = await db.rpc("studio_book", { p_session_id: sessionId });
  if (error) return { ok: false, message: studioErrorMessage(error.message) };
  return { ok: true, cardId: (data as { card_id: string | null }).card_id };
}

export async function cancelStudioBooking(db: TypedClient, bookingId: string): Promise<Result> {
  const { error } = await db.rpc("studio_cancel", { p_booking_id: bookingId });
  if (error) return { ok: false, message: studioErrorMessage(error.message) };
  return { ok: true };
}

export async function loadMyStudio(
  db: TypedClient,
  userId: string,
  now = new Date(),
): Promise<{
  cards: StudioCard[];
  current: StudioCard | null;
  adjustments: CardAdjustment[];
  upcoming: MyBooking[];
  past: MyBooking[];
}> {
  const [cardsRes, bookingsRes, adjRes] = await Promise.all([
    db.from("studio_card_status").select(CARD_COLUMNS).eq("user_id", userId),
    db
      .from("studio_bookings")
      .select("id, session_id, card_id, studio_sessions(title, starts_at)")
      .eq("user_id", userId)
      .eq("status", "booked"),
    db
      .from("studio_card_adjustments")
      .select("card_id, delta, reason, created_at")
      .order("created_at", { ascending: false }),
  ]);
  if (cardsRes.error) throw new Error(`load studio cards failed: ${cardsRes.error.message}`);
  if (bookingsRes.error)
    throw new Error(`load studio bookings failed: ${bookingsRes.error.message}`);
  if (adjRes.error) throw new Error(`load card adjustments failed: ${adjRes.error.message}`);

  const cards = cardsRes.data.map(toCard);
  const own = new Set(cards.map((c) => c.id));
  const bookings: MyBooking[] = bookingsRes.data
    .filter((b) => b.studio_sessions)
    .map((b) => ({
      id: b.id,
      sessionId: b.session_id,
      title: b.studio_sessions!.title,
      startsAt: b.studio_sessions!.starts_at,
      cardId: b.card_id,
      canCancel: canCancel(b.studio_sessions!.starts_at, now),
    }));
  const at = (b: MyBooking) => Date.parse(b.startsAt);
  return {
    cards,
    current: currentCard(cards, utcToZoned(now.toISOString()).date),
    // RLS already limits these to her cards (an admin reading would see all): keep only hers.
    adjustments: adjRes.data
      .filter((a) => own.has(a.card_id))
      .map((a) => ({
        cardId: a.card_id,
        delta: a.delta,
        reason: a.reason,
        createdAt: a.created_at,
      })),
    upcoming: bookings.filter((b) => at(b) > now.getTime()).sort((a, b) => at(a) - at(b)),
    past: bookings
      .filter((b) => at(b) <= now.getTime())
      .sort((a, b) => at(b) - at(a))
      .slice(0, 30),
  };
}

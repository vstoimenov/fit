import { addDays } from "@/lib/admin/time";

/** Аксения's price list for the trainings in the gym. Payment happens on site. */
export type CardKind = "card8" | "card12";

export const STUDIO_CARDS: Record<
  CardKind,
  { label: string; visits: number; weeks: number; priceEur: number }
> = {
  card8: { label: "Карта 8", visits: 8, weeks: 4, priceEur: 50 },
  card12: { label: "Карта 12", visits: 12, weeks: 6, priceEur: 60 },
};

export const DROP_IN_PRICE_EUR = 7;
/** A booking can be cancelled (and the visit returned) until this many hours before the start. */
export const CANCEL_HOURS = 6;
/** How far ahead the schedule is open for booking. */
export const BOOKING_DAYS = 14;
/** Walk-ins added by the trainer get a non-deliverable e-mail until they claim an invite. */
export const WALKIN_EMAIL_DOMAIN = "na-myasto.invalid";

/** Last valid day (Sofia calendar date); the start day counts as day one. */
export function cardEndsOn(startsOn: string, kind: CardKind): string {
  return addDays(startsOn, STUDIO_CARDS[kind].weeks * 7 - 1);
}

export function canCancel(startsAt: string, now: Date): boolean {
  return now.getTime() <= Date.parse(startsAt) - CANCEL_HOURS * 3_600_000;
}

export function visitsLeftText(remaining: number): string {
  if (remaining <= 0) return "няма оставащи посещения";
  if (remaining === 1) return "остава 1 посещение";
  return `остават ${remaining} посещения`;
}

/** "2026-11-26" -> "26.11" */
export const dayMonth = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`;

export function cardLine(card: { kind: CardKind; remaining: number; endsOn: string }): string {
  return `${STUDIO_CARDS[card.kind].label} · ${visitsLeftText(card.remaining)} · валидна до ${dayMonth(card.endsOn)}`;
}

/** What to nudge her about: one visit left wins over the card ending within 3 days. */
export function cardWarning(
  card: { remaining: number; endsOn: string },
  today: string,
): "low" | "expiring" | null {
  if (card.remaining <= 0 || card.endsOn < today) return null;
  if (card.remaining === 1) return "low";
  if (card.endsOn <= addDays(today, 3)) return "expiring";
  return null;
}

export function isPlaceholderEmail(email: string): boolean {
  return email.endsWith(`@${WALKIN_EMAIL_DOMAIN}`);
}

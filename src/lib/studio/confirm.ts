import { utcToZoned } from "@/lib/admin/time";
import { dayLabel } from "./format";
import { canCancel, DROP_IN_PRICE_EUR, STUDIO_CARDS, type CardKind } from "./rules";

/**
 * What the „Потвърди“ step tells her before a booking: which training, what it costs (a card
 * visit or 7 € on site — the same card rule the database applies) and whether she can still cancel.
 */
export function bookingSummary(
  session: { title: string; startsAt: string },
  card: { kind: CardKind; startsOn: string; endsOn: string; remaining: number } | null,
  now: Date,
): { when: string; payment: string; late: boolean } {
  const { date, time } = utcToZoned(session.startsAt);
  const covered = card && card.remaining > 0 && card.startsOn <= date && date <= card.endsOn;
  return {
    when: `${dayLabel(date)}, ${time} · ${session.title}`,
    payment: covered
      ? `Взема се 1 посещение от ${STUDIO_CARDS[card.kind].label} (остават ${card.remaining}).`
      : `Без карта: плащаш ${DROP_IN_PRICE_EUR} € на място.`,
    late: !canCancel(session.startsAt, now),
  };
}

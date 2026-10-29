import { utcToZoned, weekdayOf } from "@/lib/admin/time";
import { cardEndsOn, dayMonth, DROP_IN_PRICE_EUR, STUDIO_CARDS, type CardKind } from "./rules";

const WEEKDAYS = ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];

/** "2026-11-03" -> "Вторник, 3.11" */
export function dayLabel(date: string): string {
  return `${WEEKDAYS[weekdayOf(date)]}, ${dayMonth(date)}`;
}

export function cancelNotice(startsAt: string): string {
  const { date, time } = utcToZoned(startsAt);
  const day = dayLabel(date);
  // „във“ before a word starting with в/ф (вторник), „в“ otherwise.
  const prep = /^[вфВФ]/.test(day) ? "във" : "в";
  return `Тренировката ${prep} ${day.charAt(0).toLowerCase()}${day.slice(1)} от ${time} е отменена. Посещението ти е върнато.`;
}

/** „Дай карта“ preview while she types: last valid day and visits left after the notebook ones. */
export function grantPreview(kind: CardKind, startsOn: string, usedBefore: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return "";
  const left = STUDIO_CARDS[kind].visits - usedBefore;
  if (!Number.isInteger(usedBefore) || usedBefore < 0 || left <= 0) return "";
  return `Валидна до ${dayMonth(cardEndsOn(startsOn, kind))} · остават ${left}`;
}

/** One line per person on a training's list. */
export function rosterLabel(entry: {
  card: { kind: CardKind; remaining: number } | null;
  overLimit: boolean;
}): string {
  const base = entry.card
    ? `${STUDIO_CARDS[entry.card.kind].label} · остават ${entry.card.remaining}`
    : `${DROP_IN_PRICE_EUR} € на място`;
  return entry.overLimit ? `${base} · над лимита` : base;
}

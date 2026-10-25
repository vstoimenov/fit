import { shiftDay } from "@/lib/nutrition/day-param";

// Fixed table (Intl's Bulgarian month names differ by ICU build); same abbreviations as history-format.ts.
const MONTHS = [
  "яну",
  "фев",
  "мар",
  "апр",
  "май",
  "юни",
  "юли",
  "авг",
  "сеп",
  "окт",
  "ное",
  "дек",
] as const;

const DAY_MS = 86_400_000;

/** True for a real calendar date written YYYY-MM-DD (2026-02-30 is rejected). */
export function isDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  if (Number.isNaN(Date.parse(`${day}T12:00:00Z`))) return false;
  return shiftDay(day, 0) === day;
}

/** Whole days from `from` to `to` (negative when `to` is earlier); 12:00Z avoids DST drift. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

/** Calendar date of day d (1-based): start + (d - 1). */
export function dayDate(start: string, day: number): string {
  return shiftDay(start, day - 1);
}

/** Day number of a date within the challenge (1 on the start date); may fall outside 1..N. */
function dayOf(start: string, date: string): number {
  return daysBetween(start, date) + 1;
}

/** Where today sits relative to a challenge that runs start..start + days - 1. */
export function challengeStatus(
  start: string,
  days: number,
  today: string,
): { status: "upcoming" | "running" | "ended"; day: number | null } {
  if (today < start) return { status: "upcoming", day: null };
  if (today > dayDate(start, days)) return { status: "ended", day: null };
  return { status: "running", day: dayOf(start, today) };
}

/** Her first counted day: 1 when she joined on or before the start, otherwise the day she joined. */
export function firstDayFor(start: string, joinedOn: string): number {
  return Math.max(1, dayOf(start, joinedOn));
}

/** The days she may tick right now: today's and yesterday's day numbers, within 1..N and from her first day. */
export function tickableDays(
  start: string,
  days: number,
  firstDay: number,
  today: string,
): number[] {
  const todayDay = dayOf(start, today);
  return [todayDay - 1, todayDay].filter((d) => d >= Math.max(1, firstDay) && d <= days);
}

/** Ticked days out of the days she is counted for (firstDay..N). */
export function progress(
  firstDay: number,
  days: number,
  ticked: number,
): { done: number; total: number; finished: boolean } {
  const total = days - firstDay + 1;
  return { done: ticked, total, finished: total > 0 && ticked >= total };
}

/**
 * True while any day of the challenge could still be ticked: from the start through the day after the end
 * (yesterday's last day stays open that long).
 */
export function canStillTick(start: string, days: number, today: string): boolean {
  const todayDay = dayOf(start, today);
  return todayDay >= 1 && todayDay <= days + 1;
}

/** „1 ное“ for a YYYY-MM-DD day; pass today's date to add the year („1 ное 2027“) when it is another year. */
export function formatChallengeDate(day: string, today?: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  const base = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return today !== undefined && day.slice(0, 4) !== today.slice(0, 4)
    ? `${base} ${date.getUTCFullYear()}`
    : base;
}

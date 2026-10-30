import { addDays, weekdayOf } from "@/lib/admin/time";

/**
 * Calendar on /zala: whole Monday-first weeks from this week until the last bookable day, so the
 * month she can book is on one screen without paging.
 */
export function rollingGrid(today: string, days: number): string[][] {
  const last = addDays(today, days - 1);
  const weeks: string[][] = [];
  for (
    let monday = addDays(today, -weekdayOf(today));
    monday <= last;
    monday = addDays(monday, 7)
  ) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  }
  return weeks;
}

const MONTHS_SHORT = [
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
];

/** Day number, with the month on the 1st: "1 ное", "2". */
export function dayCellLabel(date: string): string {
  const day = Number(date.slice(8, 10));
  return day === 1 ? `1 ${MONTHS_SHORT[Number(date.slice(5, 7)) - 1]}` : String(day);
}

export type DayState = "none" | "mine" | "open" | "full" | "cancelled";

/** One colour per day: her booking, a free spot somewhere, all full, or all called off. */
export function dayState(
  sessions: { id: string; spotsLeft: number; cancelled: boolean }[],
  bookedIds: string[],
): DayState {
  if (sessions.length === 0) return "none";
  if (sessions.some((s) => bookedIds.includes(s.id))) return "mine";
  const live = sessions.filter((s) => !s.cancelled);
  if (live.length === 0) return "cancelled";
  return live.some((s) => s.spotsLeft > 0) ? "open" : "full";
}

/** The next `n` dates of a weekly slot (ISO weekday, 1 = Monday), today included. */
export function nextDates(weekday: number, today: string, n: number): string[] {
  const first = addDays(today, (weekday - 1 - weekdayOf(today) + 7) % 7);
  return Array.from({ length: n }, (_, i) => addDays(first, i * 7));
}

const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];

/** The little calendar leaf next to a training: "3" / "ное" / "вт". */
export function dateTile(date: string): { day: string; month: string; weekday: string } {
  return {
    day: String(Number(date.slice(8, 10))),
    month: MONTHS_SHORT[Number(date.slice(5, 7)) - 1]!,
    weekday: WEEKDAYS_SHORT[weekdayOf(date)]!,
  };
}

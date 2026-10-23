import { formatNumber } from "./format";

// Fixed tables: Intl's short "day + month" pattern differs between ICU builds ("22 окт" in browsers,
// "22.10" in some Node builds), and the label must read the same on the server and in the browser.
const WEEKDAYS = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"] as const;
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

/** „чт, 22 окт“ for a YYYY-MM-DD day. */
export function historyDayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** „чт, 22 окт — 1 580 ккал“, or „… — няма записи“ for a day without entries. */
export function historyLabel(day: string, kcal: number, count: number): string {
  return `${historyDayLabel(day)} — ${count === 0 ? "няма записи" : `${formatNumber(kcal)} ккал`}`;
}

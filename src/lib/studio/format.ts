import { utcToZoned, weekdayOf } from "@/lib/admin/time";

const WEEKDAYS = ["Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];

/** "2026-11-03" -> "Вторник, 3.11" */
export function dayLabel(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${WEEKDAYS[weekdayOf(date)]}, ${d}.${m}`;
}

export function cancelNotice(startsAt: string): string {
  const { date, time } = utcToZoned(startsAt);
  const day = dayLabel(date);
  // „във“ before a word starting with в/ф (вторник), „в“ otherwise.
  const prep = /^[вфВФ]/.test(day) ? "във" : "в";
  return `Тренировката ${prep} ${day.charAt(0).toLowerCase()}${day.slice(1)} от ${time} е отменена. Посещението ти е върнато.`;
}

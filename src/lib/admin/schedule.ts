import { ADMIN_TZ, addDays, weekdayOf, zonedToUtc } from "./time";

const MAX_COUNT = 100;

/** Publish times for `count` workouts on the chosen weekdays (0 = Monday), from startDate on. */
export function distributeDates(input: {
  startDate: string;
  weekdays: number[];
  time: string;
  count: number;
  timeZone?: string;
}): string[] {
  const days = new Set(input.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  const count = Math.min(Math.floor(input.count), MAX_COUNT);
  if (days.size === 0 || !(count > 0)) return [];
  const out: string[] = [];
  for (let date = input.startDate; out.length < count; date = addDays(date, 1)) {
    if (days.has(weekdayOf(date)))
      out.push(zonedToUtc(date, input.time, input.timeZone ?? ADMIN_TZ));
  }
  return out;
}

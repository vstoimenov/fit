import { ADMIN_TZ, addDays, weekdayOf, zonedToUtc } from "./time";

/** Publish times for `count` workouts on the chosen weekdays (0 = Monday), from startDate on. */
export function distributeDates(input: {
  startDate: string;
  weekdays: number[];
  time: string;
  count: number;
  timeZone?: string;
}): string[] {
  const days = new Set(input.weekdays.filter((d) => d >= 0 && d <= 6));
  if (days.size === 0 || input.count <= 0) return [];
  const out: string[] = [];
  for (let date = input.startDate; out.length < input.count; date = addDays(date, 1)) {
    if (days.has(weekdayOf(date)))
      out.push(zonedToUtc(date, input.time, input.timeZone ?? ADMIN_TZ));
  }
  return out;
}

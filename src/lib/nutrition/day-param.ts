const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS_BACK = 365;

/** Calendar arithmetic on a YYYY-MM-DD string (no time zone involved). */
export function shiftDay(day: string, offset: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** The days the diary accepts: from 365 days back up to and including today (Sofia). */
export function dayParamBounds(today: string): { min: string; max: string } {
  return { min: shiftDay(today, -MAX_DAYS_BACK), max: today };
}

/** The `?day=` value if it is a real date inside the diary window, otherwise today. */
export function parseDayParam(raw: string | undefined, today: string): string {
  if (raw === undefined || !DAY.test(raw)) return today;
  // Rejects 2026-02-30: the round trip through a real date must give the same string.
  if (shiftDay(raw, 0) !== raw) return today;
  const { min, max } = dayParamBounds(today);
  return raw < min || raw > max ? today : raw;
}

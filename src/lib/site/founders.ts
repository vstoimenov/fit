/** The founders campaign (/osnovatelki) closes at the end of 21 November 2026, Sofia time. */
export const FOUNDERS_LIVE_UNTIL = new Date("2026-11-22T00:00:00+02:00");

/** While true the public site keeps a small „Основателки" link in its header. */
export function foundersLive(now: Date): boolean {
  return now < FOUNDERS_LIVE_UNTIL;
}

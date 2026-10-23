/** Today's date as YYYY-MM-DD in Sofia, whatever the server's own time zone is. */
export function sofiaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Sofia" }).format(now);
}

/** The hour of day (0-23) in Sofia, whatever the server's own time zone is. */
export function sofiaHour(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour) % 24;
}

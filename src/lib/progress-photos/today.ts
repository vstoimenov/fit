/** Today's date as YYYY-MM-DD in Sofia, whatever the server's own time zone is. */
export function sofiaToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Sofia" }).format(now);
}

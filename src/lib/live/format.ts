/** „Петък, 30 октомври в 19:00" in her own timezone; the zone is named when it is not Sofia. */
export function formatLiveStart(startsAt: string, timezone: string): string {
  const at = new Date(startsAt);
  let zone = timezone;
  let text: string;
  try {
    text = new Intl.DateTimeFormat("bg-BG", {
      timeZone: zone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(at);
  } catch {
    zone = "Europe/Sofia";
    text = new Intl.DateTimeFormat("bg-BG", {
      timeZone: zone,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(at);
  }
  const capitalised = text.charAt(0).toLocaleUpperCase("bg-BG") + text.slice(1);
  const city = zone.split("/").pop()?.replace(/_/g, " ");
  return zone === "Europe/Sofia" || !city ? capitalised : `${capitalised} (${city})`;
}

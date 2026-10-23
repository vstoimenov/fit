const format = new Intl.DateTimeFormat("bg-BG", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * „12 октомври 2026" for a calendar day (YYYY-MM-DD). Formatted as UTC so no time zone can shift the
 * day, and assembled from parts because the bg-BG pattern ends in „г.", which the share image omits.
 */
export function formatLongDate(day: string): string {
  const parts = format.formatToParts(new Date(`${day}T00:00:00Z`));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}`;
}

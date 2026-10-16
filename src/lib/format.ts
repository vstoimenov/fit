export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency }).format(cents / 100);
}

/** "Петък, 16 октомври" — the calendar day of `at` in `timeZone` (Sofia by default). */
export function formatTodayDate(at: Date, timeZone = "Europe/Sofia"): string {
  const text = new Intl.DateTimeFormat("bg-BG", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
  return text.charAt(0).toLocaleUpperCase("bg-BG") + text.slice(1);
}

/** "16 октомври 2026" — the calendar day of `at` in `timeZone` (Sofia by default). */
export function formatArticleDate(at: Date, timeZone = "Europe/Sofia"): string {
  return new Intl.DateTimeFormat("bg-BG", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(at);
}

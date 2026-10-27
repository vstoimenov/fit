/** „сега“, „преди 5 мин“, „преди 3 ч.“, „преди 2 дни“, then the date — all in Sofia time. */
export function relativeTime(iso: string, now = new Date()): string {
  const diffMin = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (diffMin < 1) return "сега";
  if (diffMin < 60) return `преди ${diffMin} мин`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `преди ${hours} ч.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `преди ${days} ${days === 1 ? "ден" : "дни"}`;
  return new Intl.DateTimeFormat("bg-BG", {
    timeZone: "Europe/Sofia",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

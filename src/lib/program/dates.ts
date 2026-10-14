const LABELS = ["П", "В", "С", "Ч", "П", "С", "Н"];

/** Calendar day (YYYY-MM-DD) of an instant in a timezone. */
export function toLocalDate(at: Date | string, timeZone: string): string {
  const date = typeof at === "string" ? new Date(at) : at;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export interface WeekDay {
  date: string;
  label: string;
  isToday: boolean;
  done: boolean;
  slot: boolean;
}

/** Monday-first week containing `today`, flagged with completions and scheduled workout days. */
export function weekStrip(
  today: string,
  completionDates: string[],
  slotDates: string[],
): WeekDay[] {
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -weekday);
  const done = new Set(completionDates);
  const slots = new Set(slotDates);
  return LABELS.map((label, i) => {
    const date = addDays(monday, i);
    return { date, label, isToday: date === today, done: done.has(date), slot: slots.has(date) };
  });
}

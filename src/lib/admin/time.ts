import { AppError } from "@/lib/app-error";

export const ADMIN_TZ = "Europe/Sofia";

/** Wall-clock minus UTC (ms) for `timeZone` at instant `at`. */
function offsetMs(at: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(at / 1000) * 1000;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const invalid = () => new AppError("INVALID", "Невалидна дата или час.");

/** UTC instant (ISO) of a wall-clock date + time in a zone (throws AppError INVALID on bad input), e.g. ("2026-10-26", "07:00"). */
export function zonedToUtc(date: string, time: string, timeZone: string = ADMIN_TZ): string {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) throw invalid();
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const check = new Date(Date.UTC(y!, m! - 1, d!));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m! - 1 || check.getUTCDate() !== d) {
    throw invalid();
  }
  const wall = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  let ts = wall - offsetMs(wall, timeZone);
  ts = wall - offsetMs(ts, timeZone); // second pass settles DST transitions
  return new Date(ts).toISOString();
}

export function utcToZoned(
  iso: string,
  timeZone: string = ADMIN_TZ,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday */
export function weekdayOf(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/** "2026-10-16" -> "16.10.2026" */
export function formatDateBg(date: string): string {
  return date.split("-").reverse().join(".");
}

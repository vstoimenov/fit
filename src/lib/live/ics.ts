import { endsAt } from "./window";

export interface IcsSession {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  durationMin: number;
}

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
// RFC 5545 TEXT: backslash, semicolon and comma carry a backslash; newlines become \n.
const escape = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** A single-event calendar file (RFC 5545): UTC times, CRLF, escaped text. */
export function buildIcs(session: IcsSession, appUrl: string, now = new Date()): string {
  const base = appUrl.replace(/\/+$/, "");
  const host = new URL(base).host;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//I AM STRONG//live//BG",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${session.id}@${host}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(new Date(session.startsAt))}`,
    `DTEND:${stamp(endsAt(session))}`,
    `SUMMARY:${escape(session.title)}`,
    `DESCRIPTION:${escape(session.description)}`,
    `URL:${base}/app`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

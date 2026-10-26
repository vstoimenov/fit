import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { TypedClient } from "@/server/db/types";
import { sendToUsers, type PushTransport } from "./send";

/** Vercel Cron calls with `Authorization: Bearer <CRON_SECRET>`; anything else is refused. */
export function isCronAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface ReminderRow {
  id: string;
  timezone: string;
  push_hour: number | null;
  push_reminded_on: string | null;
  trained_today: boolean;
}

function localParts(now: Date, timezone: string): { hour: number; date: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
    }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const hour = Number(get("hour")) % 24;
    return { hour, date: `${get("year")}-${get("month")}-${get("day")}` };
  } catch {
    return null;
  }
}

/**
 * Who gets the daily reminder at `now`: her chosen hour has arrived in her own timezone, she has
 * not trained today and has not been reminded today. The job runs hourly, so the hour must match.
 */
export function dueReminders(
  rows: ReminderRow[],
  now: Date,
): Array<ReminderRow & { localDate: string }> {
  const due: Array<ReminderRow & { localDate: string }> = [];
  for (const row of rows) {
    if (row.push_hour === null || row.trained_today) continue;
    const local = localParts(now, row.timezone);
    if (!local || local.hour !== row.push_hour) continue;
    if (row.push_reminded_on === local.date) continue;
    due.push({ ...row, localDate: local.date });
  }
  return due;
}

export const reminderBody = () =>
  "Днес още не си тренирала. 20 минути стигат — пусни си тренировката.";

/** One tag per local day: a reminder must never silently replace another notification. */
export const reminderTag = (localDate: string) => `reminder-${localDate}`;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const PAGE = 1000;
const IN_CHUNK = 100;

/**
 * Daily reminders for the current hour. Claim-first: `push_reminded_on` is stamped for everyone due
 * before anything is sent, so two overlapping runs cannot send twice and a dead device never
 * retries every hour.
 */
export async function sendReminders(
  admin: TypedClient,
  now: Date,
  transport: PushTransport,
): Promise<{ users: number }> {
  const profiles: Array<{
    id: string;
    timezone: string;
    push_hour: number | null;
    push_reminded_on: string | null;
  }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, timezone, push_hour, push_reminded_on")
      .not("push_hour", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`load reminder profiles failed: ${error.message}`);
    profiles.push(...data);
    if (data.length < PAGE) break;
  }
  const candidates = dueReminders(
    profiles.map((p) => ({ ...p, trained_today: false })),
    now,
  );
  if (candidates.length === 0) return { users: 0 };

  // Claim: only rows whose stamp is not already today's come back.
  const claimed = new Set<string>();
  const byDate = new Map<string, string[]>();
  for (const c of candidates) byDate.set(c.localDate, [...(byDate.get(c.localDate) ?? []), c.id]);
  for (const [localDate, ids] of byDate) {
    for (const part of chunk(ids, IN_CHUNK)) {
      const { data, error } = await admin
        .from("profiles")
        .update({ push_reminded_on: localDate })
        .in("id", part)
        .or(`push_reminded_on.is.null,push_reminded_on.neq.${localDate}`)
        .select("id");
      if (error) throw new Error(`claim reminders failed: ${error.message}`);
      for (const row of data) claimed.add(row.id);
    }
  }
  const mine = candidates.filter((c) => claimed.has(c.id));
  if (mine.length === 0) return { users: 0 };

  const trainedKeys = new Set<string>();
  const dates = [...new Set(mine.map((c) => c.localDate))];
  for (const part of chunk(
    mine.map((c) => c.id),
    IN_CHUNK,
  )) {
    const { data, error } = await admin
      .from("workout_completions")
      .select("user_id, local_date")
      .in("user_id", part)
      .in("local_date", dates);
    if (error) throw new Error(`load completions failed: ${error.message}`);
    for (const t of data) trainedKeys.add(`${t.user_id}:${t.local_date}`);
  }
  const due = mine.filter((c) => !trainedKeys.has(`${c.id}:${c.localDate}`));
  if (due.length === 0) return { users: 0 };

  const localDate = due[0]!.localDate;
  const report = await sendToUsers(
    admin,
    due.map((d) => d.id),
    { title: "I AM STRONG", body: reminderBody(), url: "/app", tag: reminderTag(localDate) },
    transport,
  );
  if (report.users > 0) {
    const { error } = await admin.from("push_sends").insert({
      kind: "reminder",
      title: "I AM STRONG",
      body: reminderBody(),
      url: "/app",
      recipients: report.users,
    });
    if (error) console.error("reminder log failed", error.message);
  }
  return { users: report.users };
}

const NEW_WORKOUT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/** „Нова тренировка" for workouts that reached their publish time since the last run. */
export async function notifyPublishedWorkouts(
  admin: TypedClient,
  now: Date,
  transport: PushTransport,
): Promise<{ workouts: number; users: number }> {
  const { data, error } = await admin
    .from("workouts")
    .select("id, title")
    .eq("notify", true)
    .is("notified_at", null)
    .not("publish_at", "is", null)
    .lte("publish_at", now.toISOString())
    // Safety net: never announce something published long ago (e.g. after a long outage).
    .gte("publish_at", new Date(now.getTime() - NEW_WORKOUT_WINDOW_MS).toISOString());
  if (error) throw new Error(`load workouts to notify failed: ${error.message}`);
  let users = 0;
  let workouts = 0;
  for (const w of data) {
    // Claim first (only if still unmarked) so a crash or a parallel run cannot announce it twice.
    const { data: marked, error: markError } = await admin
      .from("workouts")
      .update({ notified_at: now.toISOString() })
      .eq("id", w.id)
      .is("notified_at", null)
      .select("id");
    if (markError || !marked.length) {
      if (markError) console.error("notified_at update failed", markError.message);
      continue;
    }
    workouts++;
    const payload = {
      title: "Нова тренировка",
      body: w.title,
      url: `/app/workout/${w.id}`,
      tag: `workout-${w.id}`,
    };
    const report = await sendToUsers(admin, "all", payload, transport);
    users += report.users;
    const { error } = await admin.from("push_sends").insert({
      kind: "workout",
      title: payload.title,
      body: w.title,
      url: payload.url,
      recipients: report.users,
    });
    if (error) console.error("workout push log failed", error.message);
  }
  return { workouts, users };
}

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

/** Daily reminders for the current hour; stamps `push_reminded_on` so an hour never repeats. */
export async function sendReminders(
  admin: TypedClient,
  now: Date,
  transport: PushTransport,
): Promise<{ users: number }> {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, timezone, push_hour, push_reminded_on")
    .not("push_hour", "is", null);
  if (error) throw new Error(`load reminder profiles failed: ${error.message}`);
  // Candidates for this hour first; only they need the completions lookup.
  const candidates = dueReminders(
    profiles.map((p) => ({ ...p, trained_today: false })),
    now,
  );
  if (candidates.length === 0) return { users: 0 };
  const { data: trained, error: trainedError } = await admin
    .from("workout_completions")
    .select("user_id, local_date")
    .in(
      "user_id",
      candidates.map((c) => c.id),
    )
    .in("local_date", [...new Set(candidates.map((c) => c.localDate))]);
  if (trainedError) throw new Error(`load completions failed: ${trainedError.message}`);
  const trainedKeys = new Set(trained.map((t) => `${t.user_id}:${t.local_date}`));
  const due = candidates.filter((c) => !trainedKeys.has(`${c.id}:${c.localDate}`));
  if (due.length === 0) return { users: 0 };

  const report = await sendToUsers(
    admin,
    due.map((d) => d.id),
    { title: "I AM STRONG", body: reminderBody(), url: "/app" },
    transport,
  );
  // Stamp everyone due, reached or not: a dead subscription must not retry every hour.
  for (const d of due) {
    const { error: stampError } = await admin
      .from("profiles")
      .update({ push_reminded_on: d.localDate })
      .eq("id", d.id);
    if (stampError) console.error("reminder stamp failed", stampError.message);
  }
  if (report.users > 0) {
    await admin.from("push_sends").insert({
      kind: "reminder",
      title: "I AM STRONG",
      body: reminderBody(),
      url: "/app",
      recipients: report.users,
    });
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
  for (const w of data) {
    // Mark first so a crash mid-send cannot announce the same workout twice.
    const { error: markError } = await admin
      .from("workouts")
      .update({ notified_at: now.toISOString() })
      .eq("id", w.id)
      .is("notified_at", null);
    if (markError) {
      console.error("notified_at update failed", markError.message);
      continue;
    }
    const payload = { title: "Нова тренировка", body: w.title, url: `/app/workout/${w.id}` };
    const report = await sendToUsers(admin, "all", payload, transport);
    users += report.users;
    await admin
      .from("push_sends")
      .insert({ kind: "workout", ...payload, recipients: report.users });
  }
  return { workouts: data.length, users };
}

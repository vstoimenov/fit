import "server-only";

import { endsAt } from "@/lib/live/window";
import type { TypedClient } from "@/server/db/types";

export interface LiveSession {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  durationMin: number;
  joinUrl: string;
  recordingUrl: string | null;
}

const COLUMNS = "id, title, description, starts_at, duration_min, join_url, recording_url";

type Row = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  duration_min: number;
  join_url: string;
  recording_url: string | null;
};

const toSession = (r: Row): LiveSession => ({
  id: r.id,
  title: r.title,
  description: r.description,
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  joinUrl: r.join_url,
  recordingUrl: r.recording_url,
});

/** The one to show on Начало: a running session first, otherwise the soonest upcoming. */
export function pickNextSession<T extends { startsAt: string; durationMin: number }>(
  rows: T[],
  now: Date,
): T | null {
  const live = rows
    .filter((r) => endsAt(r) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  return live[0] ?? null;
}

/** Published sessions still ahead (or running); RLS hides them from members without access. */
export async function nextLiveSession(
  db: TypedClient,
  now = new Date(),
): Promise<LiveSession | null> {
  const since = new Date(now.getTime() - 180 * 60_000).toISOString();
  const { data, error } = await db
    .from("live_sessions")
    .select(COLUMNS)
    .eq("published", true)
    .gte("starts_at", since)
    .order("starts_at")
    .limit(10);
  if (error) throw new Error(`load live sessions failed: ${error.message}`);
  return pickNextSession(data.map(toSession), now);
}

export async function getLiveSession(db: TypedClient, id: string): Promise<LiveSession | null> {
  const { data, error } = await db.from("live_sessions").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`load live session failed: ${error.message}`);
  return data ? toSession(data) : null;
}

/** Past sessions with a recording, newest first. */
export async function listRecordings(db: TypedClient, limit = 30): Promise<LiveSession[]> {
  const { data, error } = await db
    .from("live_sessions")
    .select(COLUMNS)
    .eq("published", true)
    .not("recording_url", "is", null)
    .order("starts_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`load recordings failed: ${error.message}`);
  return data.map(toSession);
}

/** „Влизам": the RPC checks access and the window and awards the points once. */
export async function attendLive(
  db: TypedClient,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await db.rpc("attend_live", { p_session_id: sessionId });
  if (!error) return { ok: true };
  if (error.code === "P0001" || error.code === "P0002")
    return { ok: false, message: error.message };
  if (error.code === "42501")
    return { ok: false, message: "Сесиите на живо са за членове с абонамент." };
  throw new Error(`attend live failed: ${error.message}`);
}

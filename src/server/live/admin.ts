import "server-only";

import { z } from "zod";
import { zonedToUtc } from "@/lib/admin/time";
import { AppError } from "@/lib/app-error";
import { endsAt } from "@/lib/live/window";
import type { TypedClient } from "@/server/db/types";

const https = (label: string) =>
  z
    .string()
    .trim()
    .max(500)
    .regex(/^https:\/\/\S+$/, `${label} трябва да е https:// линк`);

/** The admin form: date and time are typed in Europe/Sofia. */
export const liveInputSchema = z
  .object({
    title: z.string().trim().min(2, "Нужно е заглавие").max(120, "До 120 знака"),
    description: z.string().trim().max(1000, "До 1000 знака").default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Избери дата"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Избери час"),
    durationMin: z.coerce.number().int().min(15, "Поне 15 минути").max(180, "До 180 минути"),
    joinUrl: https("Линкът за влизане"),
    recordingUrl: z.union([z.literal(""), https("Записът")]).default(""),
    published: z.boolean(),
  })
  .transform((v) => ({
    title: v.title,
    description: v.description,
    startsAt: zonedToUtc(v.date, v.time),
    durationMin: v.durationMin,
    joinUrl: v.joinUrl,
    recordingUrl: v.recordingUrl === "" ? null : v.recordingUrl,
    published: v.published,
  }));
export type LiveInput = z.infer<typeof liveInputSchema>;

export interface AdminLiveSession {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  durationMin: number;
  joinUrl: string;
  recordingUrl: string | null;
  published: boolean;
  attendees: number;
  /** Already over (start + duration in the past). */
  past: boolean;
}

const COLUMNS =
  "id, title, description, starts_at, duration_min, join_url, recording_url, published, live_attendance(count)";

type Row = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  duration_min: number;
  join_url: string;
  recording_url: string | null;
  published: boolean;
  live_attendance: { count: number }[];
};

const toAdmin = (r: Row): AdminLiveSession => ({
  id: r.id,
  title: r.title,
  description: r.description,
  startsAt: r.starts_at,
  durationMin: r.duration_min,
  joinUrl: r.join_url,
  recordingUrl: r.recording_url,
  published: r.published,
  attendees: r.live_attendance[0]?.count ?? 0,
  past: endsAt({ startsAt: r.starts_at, durationMin: r.duration_min }) < new Date(),
});

export async function listLiveSessions(db: TypedClient): Promise<AdminLiveSession[]> {
  const { data, error } = await db
    .from("live_sessions")
    .select(COLUMNS)
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`list live sessions failed: ${error.message}`);
  return data.map(toAdmin);
}

export async function getAdminLiveSession(
  db: TypedClient,
  id: string,
): Promise<AdminLiveSession | null> {
  const { data, error } = await db.from("live_sessions").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`load live session failed: ${error.message}`);
  return data ? toAdmin(data) : null;
}

export async function saveLiveSession(
  db: TypedClient,
  id: string | null,
  input: LiveInput,
): Promise<{ id: string }> {
  const fields = {
    title: input.title,
    description: input.description,
    starts_at: input.startsAt,
    duration_min: input.durationMin,
    join_url: input.joinUrl,
    recording_url: input.recordingUrl,
    published: input.published,
  };
  if (id === null) {
    const { data, error } = await db.from("live_sessions").insert(fields).select("id").single();
    if (error) throw new Error(`create live session failed: ${error.message}`);
    return { id: data.id };
  }
  const { data, error } = await db.from("live_sessions").update(fields).eq("id", id).select("id");
  if (error) throw new Error(`update live session failed: ${error.message}`);
  if (data.length === 0) throw new AppError("NOT_FOUND", "Сесията не е намерена.");
  return { id };
}

export async function deleteLiveSession(db: TypedClient, id: string): Promise<void> {
  const { error } = await db.from("live_sessions").delete().eq("id", id);
  if (error) throw new Error(`delete live session failed: ${error.message}`);
}

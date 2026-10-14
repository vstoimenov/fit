import { z } from "zod";
import { workoutStatus, type WorkoutStatus } from "@/lib/admin/calendar";
import { utcToZoned, zonedToUtc } from "@/lib/admin/time";
import { AppError } from "@/lib/app-error";
import { FOCUS } from "@/lib/labels";
import type { Level, WorkoutKind } from "@/lib/program/types";
import { normalizeVideoInput, parseVideoUrl } from "@/lib/video/parse-video-url";
import type { TypedClient } from "@/server/db/types";

export const workoutInputSchema = z
  .object({
    title: z.string().trim().min(1, "Нужно е заглавие").max(120),
    description: z.string().trim().max(2000).default(""),
    kind: z.enum(["free", "starter", "regular"]),
    level: z.enum(["beginner", "advanced", "pro"]).nullable(),
    durationMin: z.number().int().min(1, "Поне 1 минута").max(180),
    focus: z.array(z.enum(FOCUS)).max(FOCUS.length),
    videoUrl: z.string().trim().min(1, "Нужен е линк").max(500),
    thumbnailUrl: z.url().nullable(),
    publishAt: z.iso.datetime({ offset: true }).nullable(),
    notify: z.boolean(),
  })
  .refine((w) => (w.kind === "regular") === (w.level !== null), {
    path: ["level"],
    message: "Обикновената тренировка има ниво; безплатната и стартовите — не.",
  })
  .refine((w) => parseVideoUrl(w.videoUrl) !== null, {
    path: ["videoUrl"],
    message: "Не разпознавам линка (YouTube, Vimeo или Bunny).",
  });

export type WorkoutInput = z.infer<typeof workoutInputSchema>;

export interface AdminWorkout {
  id: string;
  title: string;
  description: string;
  kind: WorkoutKind;
  level: Level | null;
  durationMin: number;
  focus: string[];
  thumbnailUrl: string | null;
  publishAt: string | null;
  notify: boolean;
  starterOrder: number | null;
  videoUrl: string | null;
  status: WorkoutStatus;
  completions: number;
}

const COLUMNS =
  "id, title, description, kind, level, duration_min, focus, thumbnail_url, publish_at, notify, starter_order, workout_media(video_url), workout_completions(count)";

type Row = {
  id: string;
  title: string;
  description: string;
  kind: WorkoutKind;
  level: Level | null;
  duration_min: number;
  focus: string[];
  thumbnail_url: string | null;
  publish_at: string | null;
  notify: boolean;
  starter_order: number | null;
  workout_media: { video_url: string } | { video_url: string }[] | null;
  workout_completions: { count: number }[];
};

function toAdminWorkout(r: Row, now: Date): AdminWorkout {
  const media = Array.isArray(r.workout_media) ? r.workout_media[0] : r.workout_media;
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    kind: r.kind,
    level: r.level,
    durationMin: r.duration_min,
    focus: r.focus,
    thumbnailUrl: r.thumbnail_url,
    publishAt: r.publish_at,
    notify: r.notify,
    starterOrder: r.starter_order,
    videoUrl: media?.video_url ?? null,
    status: workoutStatus(r.publish_at, now),
    completions: r.workout_completions[0]?.count ?? 0,
  };
}

export async function listAdminWorkouts(
  db: TypedClient,
  filter: { level?: Level; kind?: WorkoutKind; status?: WorkoutStatus; search?: string } = {},
  now = new Date(),
): Promise<AdminWorkout[]> {
  let query = db
    .from("workouts")
    .select(COLUMNS)
    .order("publish_at", { ascending: false, nullsFirst: true })
    .limit(500);
  if (filter.level) query = query.eq("level", filter.level);
  if (filter.kind) query = query.eq("kind", filter.kind);
  if (filter.search) query = query.ilike("title", `%${filter.search.replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw new Error(`list workouts failed: ${error.message}`);
  const rows = (data as unknown as Row[]).map((r) => toAdminWorkout(r, now));
  return filter.status ? rows.filter((w) => w.status === filter.status) : rows;
}

export async function getAdminWorkout(
  db: TypedClient,
  id: string,
  now = new Date(),
): Promise<AdminWorkout | null> {
  const { data, error } = await db.from("workouts").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`load workout failed: ${error.message}`);
  return data ? toAdminWorkout(data as unknown as Row, now) : null;
}

async function nextStarterOrder(db: TypedClient): Promise<number> {
  const { data, error } = await db
    .from("workouts")
    .select("starter_order")
    .eq("kind", "starter")
    .order("starter_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`load starter order failed: ${error.message}`);
  return (data?.starter_order ?? 0) + 1;
}

function rowFields(w: WorkoutInput) {
  return {
    title: w.title,
    description: w.description,
    kind: w.kind,
    level: w.kind === "regular" ? w.level : null,
    duration_min: w.durationMin,
    focus: w.focus,
    thumbnail_url: w.thumbnailUrl,
    publish_at: w.publishAt,
    notify: w.notify,
  };
}

export async function createAdminWorkout(
  db: TypedClient,
  userId: string,
  raw: unknown,
): Promise<string> {
  const w = workoutInputSchema.parse(raw);
  const ref = parseVideoUrl(w.videoUrl)!;
  const starter_order = w.kind === "starter" ? await nextStarterOrder(db) : null;
  const { data, error } = await db
    .from("workouts")
    .insert({ ...rowFields(w), starter_order, created_by: userId })
    .select("id")
    .single();
  if (error?.code === "23505") throw new AppError("CONFLICT", "Вече има безплатна тренировка.");
  if (error) throw new Error(`create workout failed: ${error.message}`);
  const media = await db.from("workout_media").insert({
    workout_id: data.id,
    provider: ref.provider,
    video_url: normalizeVideoInput(w.videoUrl),
  });
  if (media.error) {
    await db.from("workouts").delete().eq("id", data.id);
    throw new Error(`save video link failed: ${media.error.message}`);
  }
  return data.id;
}

export async function updateAdminWorkout(db: TypedClient, id: string, raw: unknown): Promise<void> {
  const w = workoutInputSchema.parse(raw);
  const ref = parseVideoUrl(w.videoUrl)!;
  const current = await getAdminWorkout(db, id);
  if (!current) throw new AppError("NOT_FOUND", "Тренировката не е намерена.");
  const starter_order =
    w.kind === "starter"
      ? current.kind === "starter"
        ? current.starterOrder
        : await nextStarterOrder(db)
      : null;
  const { error } = await db
    .from("workouts")
    .update({ ...rowFields(w), starter_order })
    .eq("id", id);
  if (error?.code === "23505") throw new AppError("CONFLICT", "Вече има безплатна тренировка.");
  if (error) throw new Error(`update workout failed: ${error.message}`);
  const media = await db
    .from("workout_media")
    .upsert(
      { workout_id: id, provider: ref.provider, video_url: normalizeVideoInput(w.videoUrl) },
      { onConflict: "workout_id" },
    );
  if (media.error) throw new Error(`save video link failed: ${media.error.message}`);
}

export async function scheduleWorkout(
  db: TypedClient,
  id: string,
  publishAt: string | null,
): Promise<void> {
  const value = publishAt === null ? null : z.iso.datetime({ offset: true }).parse(publishAt);
  const { data, error } = await db
    .from("workouts")
    .update({ publish_at: value })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`schedule workout failed: ${error.message}`);
  if (data.length === 0) throw new AppError("NOT_FOUND", "Тренировката не е намерена.");
}

/** Calendar drag & drop: same Sofia time on the new day (07:00 for drafts). */
export async function moveWorkoutToDate(db: TypedClient, id: string, date: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError("INVALID", "Невалидна дата.");
  const current = await getAdminWorkout(db, id);
  if (!current) throw new AppError("NOT_FOUND", "Тренировката не е намерена.");
  const time = current.publishAt ? utcToZoned(current.publishAt).time : "07:00";
  await scheduleWorkout(db, id, zonedToUtc(date, time));
}

export async function deleteAdminWorkout(db: TypedClient, id: string): Promise<void> {
  const { data, error } = await db.from("workouts").delete().eq("id", id).select("id");
  if (error) throw new Error(`delete workout failed: ${error.message}`);
  if (data.length > 0) return;
  const exists = await getAdminWorkout(db, id);
  if (exists)
    throw new AppError(
      "CONFLICT",
      "Клиентки са я завършили — скрий я (чернова) вместо да я триеш.",
    );
  throw new AppError("NOT_FOUND", "Тренировката не е намерена.");
}

export async function reorderStarters(db: TypedClient, ids: string[]): Promise<void> {
  const { error } = await db.rpc("admin_reorder_starters", { p_ids: ids });
  if (error?.code === "22023")
    throw new AppError("INVALID", "Подредбата трябва да съдържа всички стартови тренировки.");
  if (error) throw new Error(`reorder failed: ${error.message}`);
}

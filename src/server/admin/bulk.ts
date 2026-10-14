import { z } from "zod";
import { zonedToUtc } from "@/lib/admin/time";
import { actionFail } from "@/lib/action-result";
import {
  normalizeVideoInput,
  parseVideoUrl,
  type VideoProvider,
  type VideoRef,
} from "@/lib/video/parse-video-url";
import type { TypedClient } from "@/server/db/types";
import { copyThumbnail } from "./thumbnails";
import { fetchVideoMeta, type VideoMeta } from "./video-meta";
import { createAdminWorkout } from "./workouts";

const MAX_LINES = 30;
const DEFAULT_MINUTES = 30;

export interface LinkPreview {
  line: number;
  input: string;
  ok: boolean;
  error?: string;
  videoUrl?: string;
  provider?: VideoProvider;
  title?: string;
  durationMin?: number;
  thumbnailSourceUrl?: string | null;
}

export async function previewLinks(
  text: string,
  fetchMeta: (ref: VideoRef) => Promise<VideoMeta> = (ref) => fetchVideoMeta(ref),
): Promise<LinkPreview[]> {
  const lines = text
    .split(/\r?\n/)
    .map((input, i) => ({ input: input.trim(), line: i + 1 }))
    .filter((l) => l.input);
  const seen = new Map<string, number>();
  const out: LinkPreview[] = [];
  for (const { input, line } of lines) {
    if (out.length === MAX_LINES) {
      out.push({ line, input, ok: false, error: `Наведнъж до ${MAX_LINES} линка.` });
      break;
    }
    const ref = parseVideoUrl(input);
    if (!ref) {
      out.push({ line, input, ok: false, error: "Не е видео линк (YouTube, Vimeo, Bunny)." });
      continue;
    }
    const key = `${ref.provider}:${ref.id}`;
    const first = seen.get(key);
    if (first !== undefined) {
      out.push({ line, input, ok: false, error: `Повтаря ред ${first}.` });
      continue;
    }
    seen.set(key, line);
    const meta = await fetchMeta(ref);
    out.push({
      line,
      input,
      ok: true,
      videoUrl: normalizeVideoInput(input),
      provider: ref.provider,
      title: meta.title ?? `Тренировка ${out.length + 1}`,
      durationMin: meta.durationMin ?? DEFAULT_MINUTES,
      thumbnailSourceUrl: meta.thumbnailSourceUrl,
    });
  }
  return out;
}

export const bulkRowSchema = z.object({
  videoUrl: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  level: z.enum(["beginner", "advanced", "pro"]),
  durationMin: z.number().int().min(1).max(180),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Избери дата"),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  notify: z.boolean(),
  thumbnailSourceUrl: z.string().nullable(),
});
export type BulkRow = z.infer<typeof bulkRowSchema>;

/** Creates every valid row; a failing row is reported and does not stop the others. */
export async function saveBulk(
  db: TypedClient,
  userId: string,
  raw: unknown,
  copy: typeof copyThumbnail = copyThumbnail,
): Promise<{ created: number; errors: { index: number; message: string }[] }> {
  const rows = z.array(z.unknown()).max(MAX_LINES).parse(raw);
  let created = 0;
  const errors: { index: number; message: string }[] = [];
  for (const [index, item] of rows.entries()) {
    try {
      const row = bulkRowSchema.parse(item);
      const thumbnailUrl = row.thumbnailSourceUrl ? await copy(db, row.thumbnailSourceUrl) : null;
      await createAdminWorkout(db, userId, {
        title: row.title,
        description: "",
        kind: "regular",
        level: row.level,
        durationMin: row.durationMin,
        focus: [],
        videoUrl: row.videoUrl,
        thumbnailUrl: thumbnailUrl ?? undefined,
        publishAt: zonedToUtc(row.date, row.time),
        notify: row.notify,
      });
      created++;
    } catch (error) {
      errors.push({ index, message: actionFail(error).message });
    }
  }
  return { created, errors };
}

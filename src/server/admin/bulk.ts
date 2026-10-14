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
const CONCURRENCY = 5;
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

/** Runs `fn` over `items` with at most `limit` in flight; results keep the input order. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
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
  const valid: { slot: number; ref: VideoRef; input: string; number: number }[] = [];
  // Only valid links count against the cap; junk and duplicates just get their own error.
  for (const { input, line } of lines) {
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
    if (valid.length === MAX_LINES) {
      out.push({ line, input, ok: false, error: `Наведнъж до ${MAX_LINES} линка.` });
      break;
    }
    seen.set(key, line);
    valid.push({ slot: out.length, ref, input, number: valid.length + 1 });
    out.push({ line, input, ok: true });
  }
  const metas = await mapLimit(valid, CONCURRENCY, (v) => fetchMeta(v.ref));
  for (const [i, v] of valid.entries()) {
    const meta = metas[i]!;
    out[v.slot] = {
      line: out[v.slot]!.line,
      input: v.input,
      ok: true,
      videoUrl: normalizeVideoInput(v.input),
      provider: v.ref.provider,
      title: meta.title ?? `Тренировка ${v.number}`,
      durationMin: meta.durationMin ?? DEFAULT_MINUTES,
      thumbnailSourceUrl: meta.thumbnailSourceUrl,
    };
  }
  return out;
}

export const bulkRowSchema = z.object({
  videoUrl: z.string().min(1),
  title: z.string().trim().min(1, "Нужно е заглавие").max(120, "Заглавието е твърде дълго"),
  level: z.enum(["beginner", "advanced", "pro"]),
  durationMin: z
    .number("Невалидни минути")
    .int("Невалидни минути")
    .min(1, "Поне 1 минута")
    .max(180, "Най-много 180 минути"),
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
  const results = await mapLimit(rows, CONCURRENCY, async (item) => {
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
      return null;
    } catch (error) {
      return actionFail(error).message;
    }
  });
  const errors = results.flatMap((message, index) =>
    message === null ? [] : [{ index, message }],
  );
  return { created: rows.length - errors.length, errors };
}

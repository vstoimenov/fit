import type { VideoRef } from "@/lib/video/parse-video-url";

export interface VideoMeta {
  title: string | null;
  durationMin: number | null;
  thumbnailSourceUrl: string | null;
}

export const THUMBNAIL_HOSTS = new Set(["i.ytimg.com", "i.vimeocdn.com"]);
const NONE: VideoMeta = { title: null, durationMin: null, thumbnailSourceUrl: null };

function safeThumb(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && THUMBNAIL_HOSTS.has(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

function oembedUrl(ref: VideoRef): string | null {
  if (ref.provider === "youtube") {
    const page = `https://www.youtube.com/watch?v=${ref.id}`;
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(page)}`;
  }
  if (ref.provider === "vimeo") {
    const hash = new URL(ref.embedUrl).searchParams.get("h");
    const page = `https://vimeo.com/${ref.id}${hash ? `/${hash}` : ""}`;
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(page)}`;
  }
  return null;
}

/** Title, duration (Vimeo only) and a provider thumbnail URL. Best effort: never throws. */
export async function fetchVideoMeta(
  ref: VideoRef,
  fetchImpl: typeof fetch = fetch,
): Promise<VideoMeta> {
  const url = oembedUrl(ref);
  if (!url) return NONE;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return NONE;
    const body = (await res.json()) as {
      title?: unknown;
      duration?: unknown;
      thumbnail_url?: unknown;
    };
    return {
      title: typeof body.title === "string" ? body.title.slice(0, 120) : null,
      durationMin:
        typeof body.duration === "number" && body.duration > 0
          ? Math.max(1, Math.round(body.duration / 60))
          : null,
      thumbnailSourceUrl: safeThumb(body.thumbnail_url),
    };
  } catch {
    return NONE;
  }
}

import { coverPhoto } from "@/lib/photos";
import { parseVideoUrl, type VideoRef } from "@/lib/video/parse-video-url";

export type FreeWorkout = {
  id: string;
  title: string;
  durationMin: number;
  posterSrc: string;
  video: VideoRef;
};

export type SiteLinks = { trainerVideo: VideoRef | null; instagramUrl: string | null };

type FreeWorkoutRow = {
  id: string;
  title: string;
  duration_min: number;
  thumbnail_url: string | null;
  video_url: string;
};

/** The `public_free_workout()` row → what the site renders; null when there is nothing playable. */
export function mapFreeWorkout(row: FreeWorkoutRow | null): FreeWorkout | null {
  if (!row) return null;
  const video = parseVideoUrl(row.video_url);
  if (!video) return null;
  return {
    id: row.id,
    title: row.title,
    durationMin: row.duration_min,
    posterSrc: row.thumbnail_url ?? coverPhoto("full_body").src,
    video,
  };
}

function httpsString(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

/** The `public_site_links()` jsonb → parsed links; anything odd becomes null. */
export function mapSiteLinks(json: unknown): SiteLinks {
  const obj = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const trainer = httpsString(obj.trainer_video_url);
  return {
    trainerVideo: trainer ? parseVideoUrl(trainer) : null,
    instagramUrl: httpsString(obj.instagram_url),
  };
}

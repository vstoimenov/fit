import type { VideoProvider } from "./parse-video-url";

/** Clock text for the player bar: `m:ss`, or `h:mm:ss` from one hour on. */
export function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** Played share of the video in percent, clamped to 0–100 (0 when the duration is unknown). */
export function progressPercent(current: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(current)) return 0;
  return Math.min(100, Math.max(0, (current / duration) * 100));
}

/**
 * Whether this second counts toward „Завърших". YouTube reports playback, so only a playing,
 * visible video counts; the other embeds cannot report it, so they count while visible.
 */
export function countsTime(
  provider: VideoProvider,
  state: { playing: boolean; visible: boolean },
): boolean {
  if (!state.visible) return false;
  return provider === "youtube" ? state.playing : true;
}

/**
 * Seconds of playback that unlock „Завърших": the planned 70% of the typed duration, but never
 * more than 70% of the real video once YouTube reports its length (an admin may type 20 min for a
 * 13-minute video; one full play must still be enough).
 */
export function unlockThreshold(unlockAfterSec: number, videoSeconds: number): number {
  if (!Number.isFinite(videoSeconds) || videoSeconds <= 0) return unlockAfterSec;
  return Math.min(unlockAfterSec, Math.floor(videoSeconds * 0.7));
}

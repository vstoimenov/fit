"use client";

import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { completeWorkout, rateWorkout, setWorkoutWatched } from "@/app/app/workout/[id]/actions";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { LEVEL_LABEL, type FEELING_LABEL } from "@/lib/labels";
import type { CompletionPoints } from "@/lib/points/copy";
import type { VideoRef } from "@/lib/video/parse-video-url";
import { countsTime, unlockThreshold } from "@/lib/video/player-time";
import type { CompletionStats } from "@/server/content/completion";
import type { WorkoutSummary } from "@/server/content/today";
import { AfterWorkout } from "./after-workout";
import { YouTubePlayer } from "./youtube-player";

interface Completed {
  completionId: string;
  stats: CompletionStats | null;
  points: CompletionPoints | null;
}

/**
 * „Завърших" unlocks after `unlockAfterSec` of watched time (70% of the typed workout length,
 * capped at 70% of the real video once known). A YouTube video counts only while it plays and the
 * tab is visible; the other embeds cannot report playback, so they count while the tab is visible. „Гледано" is her own mark, separate from the
 * points-earning completion: set by hand, when the video ends, or by the completion itself.
 */
export function Player({
  workout,
  video,
  watched,
  first,
  unlockAfterSec,
  name,
}: {
  workout: WorkoutSummary;
  video: VideoRef;
  watched: boolean;
  first: boolean;
  unlockAfterSec: number;
  /** First name for the celebration; null when she has none. */
  name: string | null;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Real length from YouTube; 0 until known (the other embeds never report it).
  const [videoSeconds, setVideoSeconds] = useState(0);
  const [completed, setCompleted] = useState<Completed | null>(null);
  const [error, setError] = useState("");
  // The ref blocks a second tap in the same tick; state disables the button for the user.
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [mark, setMark] = useState(watched);
  const markBusy = useRef(false);
  // Ratings are sent one after another so a quick change of mind cannot land out of order.
  const ratings = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const timer = setInterval(() => {
      const visible = document.visibilityState === "visible";
      if (countsTime(video.provider, { playing, visible })) setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [video.provider, playing]);

  const threshold = unlockThreshold(unlockAfterSec, videoSeconds);
  const unlocked = elapsed >= threshold;
  const remainingMin = Math.max(1, Math.ceil((threshold - elapsed) / 60));

  async function finish() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const result = await completeWorkout(workout.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // The database marks a completed workout as watched too.
      setMark(true);
      setCompleted(result.data);
    } catch {
      setError("Нещо се обърка. Опитай отново.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  /** Optimistic: the mark flips at once and flips back if the server says no. */
  async function setWatched(next: boolean) {
    if (markBusy.current || next === mark) return;
    markBusy.current = true;
    setMark(next);
    setError("");
    try {
      const result = await setWorkoutWatched(workout.id, next);
      if (!result.ok) {
        setMark(!next);
        setError(result.message);
      }
    } catch {
      setMark(!next);
      setError("Нещо се обърка. Опитай отново.");
    } finally {
      markBusy.current = false;
    }
  }

  function rate(completionId: string, feeling: keyof typeof FEELING_LABEL) {
    // The completion is already saved; a lost rating must not trap her on this screen.
    ratings.current = ratings.current
      .then(() => rateWorkout(completionId, feeling))
      .catch(() => undefined);
  }

  if (completed) {
    return (
      <AfterWorkout
        name={name}
        workoutTitle={workout.title}
        stats={completed.stats}
        points={completed.points}
        first={first}
        completionId={completed.completionId}
        onRate={(feeling) => rate(completed.completionId, feeling)}
      />
    );
  }

  return (
    <main className="lg:px-8 lg:pb-6 lg:pt-6">
      <Link
        href="/app"
        className="inline-flex min-h-11 items-center gap-1.5 px-5 text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:mb-2 lg:px-0"
      >
        <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        Назад
      </Link>
      <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
        <div className="w-full overflow-hidden bg-ink lg:col-span-3 lg:rounded-2xl">
          {video.provider === "youtube" ? (
            <YouTubePlayer
              videoId={video.id}
              title={workout.title}
              focus={workout.focus[0] ?? null}
              onPlayingChange={setPlaying}
              onEnded={() => void setWatched(true)}
              onDuration={setVideoSeconds}
            />
          ) : (
            <div className="aspect-video w-full">
              <iframe
                src={video.embedUrl}
                title={workout.title}
                className="h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          )}
        </div>
        <section className="space-y-5 px-5 pb-6 pt-5 lg:col-span-2 lg:px-0 lg:pt-0">
          <div className="space-y-3">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
              {workout.title}
            </h1>
            <div className="flex flex-wrap gap-2">
              {workout.level && <Chip tone="powder">{LEVEL_LABEL[workout.level]}</Chip>}
              <Chip>{workout.durationMin} мин</Chip>
            </div>
            {workout.description && (
              <p className="leading-relaxed text-ink-soft">{workout.description}</p>
            )}
          </div>
          <div className="space-y-2">
            <Button onClick={finish} disabled={!unlocked || pending} className="w-full">
              {unlocked ? "Завърших тренировката" : `Завърших (след ~${remainingMin} мин)`}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void setWatched(!mark)}
              aria-pressed={mark}
              className={cn("w-full", mark && "text-moss ring-moss")}
            >
              <Check
                size={18}
                strokeWidth={2.5}
                aria-hidden="true"
                className={mark ? undefined : "opacity-40"}
              />
              {mark ? "Гледано" : "Отбележи като гледано"}
            </Button>
            <p className="text-center text-xs text-ink-soft">
              „Гледано“ е бележка за теб. Точки печелиш със „Завърших“.
            </p>
            {error && (
              <p role="alert" className="text-center text-sm font-semibold text-brick">
                {error}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

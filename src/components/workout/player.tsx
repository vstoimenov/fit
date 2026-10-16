"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { completeWorkout, rateWorkout } from "@/app/app/workout/[id]/actions";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { LEVEL_LABEL, type FEELING_LABEL } from "@/lib/labels";
import type { CompletionStats } from "@/server/content/completion";
import type { WorkoutSummary } from "@/server/content/today";
import { AfterWorkout } from "./after-workout";

interface Completed {
  completionId: string;
  stats: CompletionStats | null;
}

/**
 * „Завърших" unlocks after `unlockAfterSec` of visible playback time (70% of the
 * workout length). Time only counts while the tab is visible.
 */
export function Player({
  workout,
  embedUrl,
  first,
  unlockAfterSec,
  name,
}: {
  workout: WorkoutSummary;
  embedUrl: string;
  first: boolean;
  unlockAfterSec: number;
  /** First name for the celebration; null when she has none. */
  name: string | null;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState<Completed | null>(null);
  const [error, setError] = useState("");
  // The ref blocks a second tap in the same tick; state disables the button for the user.
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  // Ratings are sent one after another so a quick change of mind cannot land out of order.
  const ratings = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setElapsed((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unlocked = elapsed >= unlockAfterSec;
  const remainingMin = Math.max(1, Math.ceil((unlockAfterSec - elapsed) / 60));

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
      setCompleted(result.data);
    } catch {
      setError("Нещо се обърка. Опитай отново.");
    } finally {
      busy.current = false;
      setPending(false);
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
        <div className="aspect-video w-full overflow-hidden bg-black lg:col-span-3 lg:rounded-2xl">
          <iframe
            src={embedUrl}
            title={workout.title}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
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

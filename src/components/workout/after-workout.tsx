"use client";

import { Flame } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { FEELING_LABEL } from "@/lib/labels";
import { transitionFor } from "@/lib/motion";
import { afterWorkoutLines, type CompletionPoints } from "@/lib/points/copy";
import { shareText, streakPhrase, toShareCard } from "@/lib/share/share-card";
import type { CompletionStats } from "@/server/content/completion";
import { ShareButton } from "./share-button";

type Feeling = keyof typeof FEELING_LABEL;

/**
 * Shown by the player once „Завърших" is saved: celebration, streak and week progress, points,
 * „Как беше?" rating, then the way out (Начало, or the plans after the free first workout).
 */
export function AfterWorkout({
  name,
  workoutTitle,
  stats,
  points,
  first,
  onRate,
  completionId,
}: {
  name?: string | null;
  /** Shown in the share text; the image reads its own copy on the server. */
  workoutTitle: string;
  /** Null when the numbers could not be read; the line is then hidden. */
  stats: CompletionStats | null;
  /** Null when the points could not be read; the lines are then hidden. */
  points: CompletionPoints | null;
  first: boolean;
  /** Fire-and-forget: a lost rating must not trap her on this screen. */
  onRate: (feeling: Feeling) => void;
  /** The saved completion; the share image is rendered from it. */
  completionId: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // The previous screen (the video) is gone; move focus to the new heading.
  useEffect(() => heading.current?.focus(), []);

  const statsLine = stats
    ? [
        stats.streakDays > 0 ? streakPhrase(stats.streakDays) : null,
        `${stats.weekDone}/${stats.weekTarget} тази седмица`,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const pointsLines = afterWorkoutLines(points);

  // Title and numbers only (see toShareCard); without stats the text is just the title.
  const text = stats
    ? shareText(toShareCard({ workoutTitle, ...stats }))
    : toShareCard({ workoutTitle }).workoutTitle;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-md flex-col justify-center gap-8 px-5 py-10 text-center lg:min-h-[calc(100dvh-2.5rem)]">
      <div className="space-y-4">
        <motion.div
          initial={reduced ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={transitionFor(reduced, "pop")}
          className="mx-auto flex size-24 items-center justify-center rounded-full bg-powder-light"
        >
          <Flame size={44} strokeWidth={2} className="text-rose-deep" aria-hidden="true" />
        </motion.div>
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-3xl font-extrabold tracking-tight outline-none"
        >
          {name ? `Браво, ${name}!` : "Браво!"}
        </h1>
        {statsLine && <p className="font-semibold text-ink-soft">{statsLine}</p>}
        {pointsLines.length > 0 && (
          <div role="status" className="space-y-1">
            {pointsLines.map((line, i) => (
              <p
                key={line}
                className={i === 0 ? "font-extrabold text-ink" : "font-semibold text-ink-soft"}
              >
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      <section aria-labelledby="feeling-title" className="space-y-3">
        <h2 id="feeling-title" className="text-base font-extrabold">
          Как беше?
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(FEELING_LABEL) as Feeling[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={feeling === f}
              onClick={() => {
                setFeeling(f);
                onRate(f);
              }}
              className={cn(
                "min-h-11 rounded-full px-3 text-sm font-semibold transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                feeling === f
                  ? "bg-powder-light text-rose-deep ring-2 ring-inset ring-powder"
                  : "bg-sand text-ink",
              )}
            >
              {FEELING_LABEL[f]}
            </button>
          ))}
        </div>
      </section>

      <div className="space-y-3">
        <ShareButton completionId={completionId} text={text} />
        <Link
          href={`/app/community?share=${completionId}&title=${encodeURIComponent(workoutTitle)}`}
          className={cn(buttonClass("secondary", "lg"), "w-full")}
        >
          Сподели в общността
        </Link>
      </div>

      <Link
        href={first ? "/app/plan?after=first" : "/app"}
        className={cn(buttonClass("primary", "lg"), "w-full")}
      >
        {first ? "Виж плановете" : "Към началото"}
      </Link>
    </main>
  );
}

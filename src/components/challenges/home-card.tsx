"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { dayLabel } from "@/lib/challenges/format";
import type { HomeChallenge } from "@/server/challenges/challenges";
import { TickButton, TickStatus } from "./tick-button";
import { useTicks } from "./use-ticks";

/**
 * The Начало card of the running challenge she joined: „Ден X от N · задачата за днес“ with the tick.
 * Начало keeps its one primary button (the workout), so the tick here is the quiet kind.
 */
export function HomeChallengeCard({ data }: { data: HomeChallenge }) {
  const { challenge, day, task, tickable, done: serverDone, more } = data;
  const { done, pending, error, toast, toggle } = useTicks(challenge.id, { [day]: serverDone });
  const state = done[day] ?? false;

  return (
    <section
      aria-label={`Предизвикателство: ${challenge.title}`}
      className="space-y-3 rounded-2xl bg-sand p-4"
    >
      <Link
        href={`/app/challenges/${challenge.id}`}
        className="flex min-h-11 items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm font-semibold text-ink-soft">{challenge.title}</span>
          <span className="block break-words font-extrabold">
            {dayLabel("running", day, challenge.days, "")} · {task}
          </span>
        </span>
        <ChevronRight size={20} strokeWidth={2} aria-hidden="true" className="shrink-0" />
      </Link>
      {tickable && (
        <TickButton
          done={state}
          pending={pending}
          onToggle={() => toggle(day)}
          size="md"
          className="w-full"
        />
      )}
      <TickStatus toast={toast} error={error} />
      {more > 0 && (
        <Link
          href="/app/challenges"
          className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          +{more} още
        </Link>
      )}
    </section>
  );
}

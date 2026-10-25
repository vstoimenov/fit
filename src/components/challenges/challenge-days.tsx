"use client";

import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { formatChallengeDate } from "@/lib/challenges/calendar";
import { cn } from "@/lib/cn";
import type { ChallengeDayView } from "@/server/challenges/challenges";
import { TickButton, TickStatus } from "./tick-button";
import { useTicks } from "./use-ticks";

const HINT = "Тренировката е отбелязана — отметни и задачата.";

const workoutLinkClass =
  "inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * Today's task and the day list of one challenge. Both share one tick state, so ticking today's task
 * checks its row at once. Today's task has the screen's primary button; a catch-up for yesterday is a
 * quiet one in its row. `canTick` is false for someone who has not joined or whose plan has lapsed.
 */
export function ChallengeDays({
  challengeId,
  days,
  todayDay,
  total,
  canTick,
}: {
  challengeId: string;
  days: ChallengeDayView[];
  /** Day number of today while the challenge runs, otherwise null. */
  todayDay: number | null;
  total: number;
  canTick: boolean;
}) {
  const { done, pending, error, toast, toggle } = useTicks(
    challengeId,
    Object.fromEntries(days.map((d) => [d.day, d.done])),
  );
  const today = todayDay === null ? undefined : days.find((d) => d.day === todayDay);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {today && (
          <section aria-labelledby="today-heading" className="space-y-3 rounded-2xl bg-sand p-5">
            <p className="text-sm font-semibold text-ink-soft">
              <span id="today-heading">Днес</span> · Ден {today.day} от {total}
            </p>
            <p className="break-words text-2xl font-extrabold tracking-tight">{today.task}</p>
            {today.workout && (
              <Link href={`/app/workout/${today.workout.id}`} className={workoutLinkClass}>
                Тренировка: {today.workout.title}
              </Link>
            )}
            {canTick && today.tickable && today.workoutDoneToday && !done[today.day] && (
              <p className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold">{HINT}</p>
            )}
            {canTick && today.tickable && (
              <TickButton
                done={done[today.day] ?? false}
                pending={pending}
                onToggle={() => toggle(today.day)}
                primary
                className="w-full"
              />
            )}
          </section>
        )}
        <TickStatus toast={toast} error={error} />
      </div>

      <section aria-labelledby="days-heading" className="space-y-3">
        <h2 id="days-heading" className="text-xl font-extrabold tracking-tight">
          Дните
        </h2>
        <ol className="space-y-2">
          {days.map((d) => {
            const isDone = done[d.day] ?? false;
            const isToday = d.day === todayDay;
            // Today's button is the one above; a row's button is the one-day catch-up.
            const catchUp = canTick && d.tickable && !isToday;
            return (
              <li
                key={d.day}
                className={cn(
                  "flex gap-3 rounded-2xl p-3",
                  isToday ? "bg-powder-light" : "ring-1 ring-line",
                  (d.locked || d.beforeJoin) && "text-ink-soft",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold",
                    isDone ? "bg-ink text-white" : "bg-sand text-ink",
                  )}
                >
                  {isDone ? (
                    <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                  ) : d.locked ? (
                    <Lock size={14} strokeWidth={2.25} aria-hidden="true" />
                  ) : (
                    d.day
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">
                    <span>
                      Ден {d.day} · {formatChallengeDate(d.date)}
                    </span>
                    {isToday && <Chip tone="powder">Днес</Chip>}
                    {isDone && <span className="text-ink">Направено</span>}
                    {d.locked && <span className="sr-only">Предстои</span>}
                  </p>
                  <p className="break-words font-semibold">{d.task}</p>
                  {d.beforeJoin && (
                    <p className="text-sm font-semibold text-ink-soft">Преди да се включиш</p>
                  )}
                  {d.workout && (
                    <Link href={`/app/workout/${d.workout.id}`} className={workoutLinkClass}>
                      Тренировка: {d.workout.title}
                    </Link>
                  )}
                  {catchUp && (
                    <div>
                      <TickButton
                        done={isDone}
                        pending={pending}
                        onToggle={() => toggle(d.day)}
                        label={`Направих го — ден ${d.day}`}
                        size="md"
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

import { Lock } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { LEVEL_LABEL } from "@/lib/labels";
import type { WorkoutSummary } from "@/server/content/today";
import { WorkoutCover } from "./workout-cover";

/**
 * Library card: photo cover, title and level + duration chips. Locked cards lead to the plans.
 * An exclusive workout she has not reached yet (`unlockLevel`) shows its level and opens the
 * workout page, which explains the lock, whatever her subscription.
 */
export function WorkoutCard({
  workout,
  locked,
  unlockLevel = null,
  href = locked && unlockLevel === null ? "/app/plan" : `/app/workout/${workout.id}`,
}: {
  workout: WorkoutSummary;
  locked: boolean;
  unlockLevel?: number | null;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-2xl bg-sand active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <div className="relative">
        <WorkoutCover
          focus={workout.focus[0] ?? null}
          title={workout.title}
          showTitle={false}
          decorative
          sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
          className="h-44"
        />
        {(unlockLevel !== null || locked) && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-ink">
            <Lock size={14} strokeWidth={2.25} aria-hidden="true" />
            {unlockLevel !== null ? `Отключва се на ниво ${unlockLevel}` : "С абонамент"}
          </span>
        )}
      </div>
      <div className="space-y-3 p-4">
        <p className="text-base font-extrabold leading-snug">{workout.title}</p>
        <div className="flex flex-wrap gap-2">
          {workout.level && <Chip tone="powder">{LEVEL_LABEL[workout.level]}</Chip>}
          <Chip className="bg-white">{workout.durationMin} мин</Chip>
        </div>
      </div>
    </Link>
  );
}

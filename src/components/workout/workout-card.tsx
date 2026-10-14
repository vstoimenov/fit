import Link from "next/link";
import { FOCUS_LABEL, LEVEL_LABEL, type Focus } from "@/lib/labels";
import type { WorkoutSummary } from "@/server/content/today";
import { WorkoutCover } from "./workout-cover";

export function WorkoutCard({
  workout,
  locked,
  href = locked ? "/app/plan" : `/app/workout/${workout.id}`,
}: {
  workout: WorkoutSummary;
  locked: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-line transition-transform active:scale-[0.98]"
    >
      <div className="relative">
        <WorkoutCover
          level={workout.level}
          kind={workout.kind}
          title={workout.title}
          className="h-28"
        />
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-sm font-bold text-paper">
            🔒 С абонамент
          </span>
        )}
      </div>
      <div className="space-y-1 p-4">
        <p className="font-semibold leading-snug">{workout.title}</p>
        <p className="text-sm text-ink-soft">
          {workout.durationMin} мин
          {workout.level ? ` · ${LEVEL_LABEL[workout.level]}` : ""}
          {workout.focus.length
            ? ` · ${workout.focus.map((f) => FOCUS_LABEL[f as Focus] ?? f).join(", ")}`
            : ""}
        </p>
      </div>
    </Link>
  );
}

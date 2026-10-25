import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { dayLabel, participantsLabel, progressLabel } from "@/lib/challenges/format";
import type { MemberChallengeItem } from "@/server/challenges/challenges";

/** One challenge in the list: title, where it is in time, who takes part and, once joined, her bar. */
export function ChallengeCard({ item }: { item: MemberChallengeItem }) {
  const pct =
    item.progress && item.progress.total > 0
      ? Math.round(Math.min(1, item.progress.done / item.progress.total) * 100)
      : 0;
  return (
    <Link
      href={`/app/challenges/${item.id}`}
      className="flex min-h-14 items-center gap-3 rounded-2xl bg-sand p-4 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="min-w-0 flex-1 space-y-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="block break-words font-extrabold">{item.title}</span>
          {item.joined && <Chip tone="powder">Включена</Chip>}
        </span>
        <span className="block text-sm text-ink-soft">
          {dayLabel(item.status, item.day, item.days, item.startDate)} ·{" "}
          {participantsLabel(item.participants)}
        </span>
        {item.progress && (
          <span className="block space-y-1">
            <span
              role="progressbar"
              aria-label={`Напредък: ${item.title}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              aria-valuetext={progressLabel(item.progress)}
              className="block h-1.5 overflow-hidden rounded-full bg-white"
            >
              <span className="block h-full rounded-full bg-powder" style={{ width: `${pct}%` }} />
            </span>
            <span className="block text-xs font-semibold text-ink-soft">
              {progressLabel(item.progress)}
            </span>
          </span>
        )}
      </span>
      <ChevronRight size={20} strokeWidth={2} aria-hidden="true" className="shrink-0" />
    </Link>
  );
}

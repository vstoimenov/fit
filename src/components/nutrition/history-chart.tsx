import Link from "next/link";
import { dayResult, showDayResult } from "@/lib/nutrition/day";
import { dayHref, historyLabel } from "@/lib/nutrition/history-format";

export type HistoryDay = { day: string; kcal: number; count: number };

const W = 300;
const H = 120;
const TOP = 6;
const BASE = H - 2;

/**
 * 30 bars, oldest to newest, one per day. Sand bars; days that landed within the target powder
 * (only once the day's result may be shown, see showDayResult). A dashed line marks the target.
 * Every bar is a link to that day. Without `today` every day counts as a past day.
 */
export function HistoryChart({
  days,
  target,
  today,
  hour,
}: {
  days: HistoryDay[];
  target: number | null;
  today?: string;
  hour?: number;
}) {
  if (days.length === 0) return null;
  const slot = W / days.length;
  const barW = slot * 0.7;
  const max = Math.max(1, target ?? 0, ...days.map((d) => d.kcal));
  // Headroom so the tallest bar or the target line never touches the top edge.
  const scale = (BASE - TOP) / max;
  const targetY = target ? BASE - target * scale : null;

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="group"
        aria-label="Калории по дни за последните 30 дни"
      >
        {days.map((d, i) => {
          const x = i * slot + (slot - barW) / 2;
          const h = d.count === 0 ? 2 : Math.max(2, d.kcal * scale);
          const inTarget =
            target !== null &&
            d.count > 0 &&
            (today === undefined || hour === undefined || showDayResult(d.day, today, hour)) &&
            dayResult(d.kcal, target) === "in";
          return (
            <Link
              key={d.day}
              href={today ? dayHref(d.day, today) : `/app/nutrition?day=${d.day}`}
              aria-label={historyLabel(d.day, d.kcal, d.count)}
              className="focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink"
            >
              {/* Full-height transparent column: a bigger tap area than the bar itself. */}
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              <rect
                x={x}
                y={BASE - h}
                width={barW}
                height={h}
                rx={1.5}
                fill={inTarget ? "var(--color-powder)" : "var(--color-sand)"}
                stroke={inTarget ? "var(--color-powder)" : "var(--color-line)"}
                strokeWidth={0.75}
              />
            </Link>
          );
        })}
        {targetY !== null && (
          <line
            x1={0}
            x2={W}
            y1={targetY}
            y2={targetY}
            stroke="var(--color-ink)"
            strokeWidth={1}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
      </svg>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
        {target !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 border-t border-dashed border-ink" />
            Цел
          </span>
        )}
        {target !== null && (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-powder" />В целта
          </span>
        )}
      </p>
    </div>
  );
}

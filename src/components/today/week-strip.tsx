import type { WeekDay } from "@/lib/program/dates";
import { cn } from "@/lib/cn";

export function WeekStrip({ week }: { week: WeekDay[] }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {week.map((d) => (
        <li key={d.date} className="flex flex-col items-center gap-1.5">
          <span className={cn("text-xs font-semibold", d.isToday ? "text-ink" : "text-ink-soft")}>
            {d.label}
          </span>
          <span
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold",
              d.done
                ? "border-ink bg-ink text-paper"
                : d.slot
                  ? "border-ember text-ember"
                  : "border-line text-ink-soft",
              d.isToday && !d.done && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
            )}
            aria-label={`${d.date}${d.done ? ", тренирала" : ""}${d.slot ? ", има тренировка" : ""}`}
          >
            {d.done ? "✓" : Number(d.date.slice(8))}
          </span>
        </li>
      ))}
    </ol>
  );
}

import type { WeekDay } from "@/lib/program/dates";
import { cn } from "@/lib/cn";

/** Monday-first week: done days powder, today outlined in ink, the rest sand. */
export function WeekStrip({ week }: { week: WeekDay[] }) {
  return (
    <ol className="grid grid-cols-7 gap-2" aria-label="Тази седмица">
      {week.map((d) => (
        <li key={d.date} className="flex justify-center">
          <span
            className={cn(
              "flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-sm font-bold",
              d.done ? "bg-powder text-white" : "bg-sand text-ink-soft",
              d.isToday && "ring-2 ring-ink ring-offset-2 ring-offset-white",
              d.isToday && !d.done && "bg-white text-ink",
            )}
            aria-label={`${d.date}${d.isToday ? ", днес" : ""}${d.done ? ", тренирала" : ""}`}
            aria-current={d.isToday ? "date" : undefined}
          >
            {d.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

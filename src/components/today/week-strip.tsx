import { Check } from "lucide-react";
import type { WeekDay } from "@/lib/program/dates";
import { cn } from "@/lib/cn";

const WEEKDAY_NAME = ["понеделник", "вторник", "сряда", "четвъртък", "петък", "събота", "неделя"];

/** Monday-first week: done days powder with a check, today outlined in ink, the rest sand. */
export function WeekStrip({ week }: { week: WeekDay[] }) {
  return (
    <ol className="grid grid-cols-7 gap-2" aria-label="Тази седмица">
      {week.map((d, i) => (
        <li
          key={d.date}
          aria-current={d.isToday ? "date" : undefined}
          className="flex justify-center"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex aspect-square w-full max-w-11 flex-col items-center justify-center rounded-full text-sm font-bold leading-none",
              d.done && "bg-powder text-ink",
              !d.done && (d.isToday ? "bg-white text-ink" : "bg-sand text-ink-soft"),
              d.isToday && "ring-2 ring-ink ring-offset-2 ring-offset-white",
            )}
          >
            {d.label}
            {d.done && <Check size={12} strokeWidth={3} className="mt-0.5" />}
          </span>
          <span className="sr-only">
            {WEEKDAY_NAME[i]}
            {d.isToday ? ", днес" : ""}
            {d.done ? ", направена" : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

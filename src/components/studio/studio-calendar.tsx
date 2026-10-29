"use client";

import { useMemo, useState } from "react";
import { utcToZoned } from "@/lib/admin/time";
import { cn } from "@/lib/cn";
import { dayCellLabel, dayState, rollingGrid, type DayState } from "@/lib/studio/calendar";
import { addDays } from "@/lib/admin/time";
import { BOOKING_DAYS, dayMonth } from "@/lib/studio/rules";
import type { StudioSession } from "@/server/studio/schedule";
import { ScheduleList } from "./schedule-list";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

const STATE_LABEL: Record<DayState, string> = {
  none: "няма тренировки",
  mine: "записана си",
  open: "има места",
  full: "пълно",
  cancelled: "отменено",
};

const STATE_CLASS: Record<DayState, string> = {
  none: "text-ink-soft/50",
  mine: "bg-ink text-white",
  open: "bg-powder-light text-rose-deep font-bold",
  full: "bg-sand text-ink-soft line-through",
  cancelled: "text-ink-soft/50 line-through",
};

/**
 * The bookable month at a glance (whole weeks from today): each day coloured by what she can do
 * there; tapping a day lists its trainings with „Запиши се“ underneath. Opens on the first day
 * that has trainings.
 */
export function StudioCalendar({
  sessions,
  bookedIds,
  busyId,
  onBook,
  today,
}: {
  sessions: StudioSession[];
  bookedIds: string[];
  busyId: string | null;
  onBook: (session: StudioSession) => void;
  today: string;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, StudioSession[]>();
    for (const s of sessions) {
      const { date } = utcToZoned(s.startsAt);
      map.set(date, [...(map.get(date) ?? []), s]);
    }
    return map;
  }, [sessions]);
  const firstDay = [...byDate.keys()].filter((d) => d >= today).sort()[0] ?? today;
  const [selected, setSelected] = useState(firstDay);
  const lastDay = addDays(today, BOOKING_DAYS - 1);
  const daySessions = byDate.get(selected) ?? [];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-white p-4 ring-1 ring-line sm:p-5">
        <p className="mb-3 text-center font-bold">
          {dayMonth(today)} – {dayMonth(lastDay)}
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-soft">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {rollingGrid(today, BOOKING_DAYS)
            .flat()
            .map((date) => {
              const list = byDate.get(date) ?? [];
              const state = date < today || date > lastDay ? "none" : dayState(list, bookedIds);
              const active = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={`${dayMonth(date)} · ${STATE_LABEL[state]}`}
                  aria-pressed={active}
                  disabled={state === "none"}
                  onClick={() => setSelected(date)}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-2xl text-sm transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                    STATE_CLASS[state],
                    active && "ring-2 ring-ink ring-offset-2",
                    date === today && state === "none" && "font-bold text-ink",
                  )}
                >
                  <span className={cn(date.endsWith("-01") && "text-[11px] leading-tight")}>
                    {dayCellLabel(date)}
                  </span>
                  {state !== "none" && list.length > 1 && (
                    <span className="absolute bottom-1 text-[10px] leading-none opacity-80">
                      {list.length}×
                    </span>
                  )}
                </button>
              );
            })}
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-powder-light ring-1 ring-rose-deep/30" />
            Има места
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-ink" />
            Записана си
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-sand ring-1 ring-line" />
            Пълно
          </li>
        </ul>
      </div>

      {daySessions.length > 0 ? (
        <ScheduleList
          sessions={daySessions}
          bookedIds={bookedIds}
          busyId={busyId}
          onBook={onBook}
        />
      ) : (
        <p className="text-ink-soft">
          {sessions.length === 0
            ? "Графикът още не е готов."
            : "Избери оцветен ден, за да видиш часовете."}
        </p>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import type { AdminWorkout } from "@/server/admin/workouts";
import { moveWorkoutAction } from "./actions";

const TONE = { beginner: "border-moss", advanced: "border-mustard", pro: "border-brick" } as const;

export function MonthView({
  weeks,
  month,
  today,
  byDate,
}: {
  weeks: string[][];
  month: string; // YYYY-MM
  today: string;
  byDate: Record<string, (AdminWorkout & { localTime: string })[]>;
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function drop(date: string, id: string) {
    startTransition(async () => {
      const r = await moveWorkoutAction(id, date);
      setMessage(r.ok ? `Преместена за ${date} ✓` : r.message);
    });
  }

  return (
    <div className="space-y-2">
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-soft">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className={cn("grid grid-cols-7 gap-1", pending && "opacity-60")}>
        {weeks.flat().map((date) => (
          <div
            key={date}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => drop(date, e.dataTransfer.getData("text/plain"))}
            className={cn(
              "min-h-24 rounded-xl bg-white p-1 ring-1 ring-line",
              !date.startsWith(month) && "opacity-50",
              date === today && "ring-2 ring-ink",
            )}
          >
            <p className="text-right text-xs tabular-nums text-ink-soft">{Number(date.slice(8))}</p>
            <ul className="space-y-1">
              {(byDate[date] ?? []).map((w) => (
                <li key={w.id}>
                  <Link
                    href={`/admin/workouts/${w.id}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", w.id)}
                    className={cn(
                      "block truncate rounded-lg border-l-4 bg-paper px-1 py-0.5 text-left text-[11px]",
                      w.level ? TONE[w.level] : "border-ember",
                      w.status === "draft" && "opacity-60",
                    )}
                    title={`${w.localTime} · ${w.title}`}
                  >
                    {w.localTime} {w.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-soft">
        Плъзни тренировка върху друг ден, за да я преместиш (часът се запазва).
      </p>
    </div>
  );
}

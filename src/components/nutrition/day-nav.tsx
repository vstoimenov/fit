"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type ReactNode, type TouchEvent } from "react";
import { cn } from "@/lib/cn";
import { dayParamBounds, shiftDay } from "@/lib/nutrition/day-param";

const SWIPE_MIN_PX = 64;

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** „чт, 22 окт“ for a YYYY-MM-DD day. */
function dayLabel(day: string): string {
  return dateFormat.format(new Date(`${day}T12:00:00Z`)).replace(/\.$/, "");
}

function hrefFor(day: string, today: string): string {
  return day === today ? "/app/nutrition" : `/app/nutrition?day=${day}`;
}

const arrowClass =
  "flex size-11 items-center justify-center rounded-full ring-[1.5px] ring-inset ring-ink active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * Day header with ‹ › (no future, nothing older than a year) and a horizontal swipe over `children`.
 * Days are plain links, so the state lives in the URL and the back button works.
 */
export function DayNav({
  day,
  today,
  children,
}: {
  day: string;
  today: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);
  const { min, max } = dayParamBounds(today);
  const prev = day > min ? shiftDay(day, -1) : null;
  const next = day < max ? shiftDay(day, 1) : null;

  const main = day === today ? "Днес" : day === shiftDay(today, -1) ? "Вчера" : dayLabel(day);
  const sub = day === today || day === shiftDay(today, -1) ? dayLabel(day) : null;

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    // A swipe that starts in a field is the member selecting or scrolling text, not changing the day.
    const inField = (event.target as HTMLElement).closest("input, textarea, select");
    // An open add panel or amount edit is a <form>: changing the day would throw away what she typed.
    const formOpen = event.currentTarget.querySelector("form") !== null;
    start.current =
      touch && !inField && !formOpen && event.touches.length === 1
        ? { x: touch.clientX, y: touch.clientY }
        : null;
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const from = start.current;
    const touch = event.changedTouches[0];
    start.current = null;
    if (!from || !touch) return;
    const dx = touch.clientX - from.x;
    const dy = touch.clientY - from.y;
    // Mostly horizontal and long enough; vertical scrolling must never change the day.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const target = dx > 0 ? prev : next; // drag right = earlier day
    if (target) router.push(hrefFor(target, today));
  }

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} className="space-y-6">
      <nav aria-label="Ден" className="flex items-center justify-between gap-3">
        {prev ? (
          <Link
            href={hrefFor(prev, today)}
            aria-label="Предишен ден"
            className={arrowClass}
            scroll={false}
          >
            <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span aria-hidden="true" className={cn(arrowClass, "pointer-events-none opacity-30")}>
            <ChevronLeft size={22} strokeWidth={2} />
          </span>
        )}
        <div className="text-center">
          <h2 className="text-lg font-extrabold tracking-tight">{main}</h2>
          {sub && <p className="text-xs font-semibold text-ink-soft">{sub}</p>}
        </div>
        {next ? (
          <Link
            href={hrefFor(next, today)}
            aria-label="Следващ ден"
            className={arrowClass}
            scroll={false}
          >
            <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : (
          <span aria-hidden="true" className={cn(arrowClass, "pointer-events-none opacity-30")}>
            <ChevronRight size={22} strokeWidth={2} />
          </span>
        )}
      </nav>
      {children}
    </div>
  );
}

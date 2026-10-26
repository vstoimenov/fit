"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useRef, type PointerEvent } from "react";
import { FIRST_14_DAYS } from "@/lib/challenges/template";
import { cn } from "@/lib/cn";
import { DISPLAY, WRAP } from "./styles";

const MILESTONES = new Set([1, 7, 14]);

/** The 14-day starter challenge as a horizontal strip: there is a plan from day one. */
export function First14() {
  const strip = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion() ?? false;
  const drag = useRef<{ x: number; left: number } | null>(null);

  const by = (direction: 1 | -1) => {
    const el = strip.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("li");
    const step = (card?.offsetWidth ?? 240) + 16;
    el.scrollBy({ left: direction * step, behavior: reduced ? "auto" : "smooth" });
  };

  const onPointerDown = (e: PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse") return;
    drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLUListElement>) => {
    if (!drag.current) return;
    e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <section id="parvite-14" className="scroll-mt-20 py-20 lg:py-28">
      <div className={`${WRAP} flex items-end justify-between gap-6`}>
        <div>
          <h2 className={`${DISPLAY} text-4xl sm:text-[56px]`}>Има план от първия ден</h2>
          <p className="mt-3 text-lg text-ink-soft">
            „Първите 14 дни“: една малка задача на ден, заедно с останалите.
          </p>
        </div>
        <div className="hidden gap-2 lg:flex">
          <button
            type="button"
            onClick={() => by(-1)}
            aria-label="Назад"
            className="inline-flex size-12 items-center justify-center rounded-full border-[1.5px] border-ink hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => by(1)}
            aria-label="Напред"
            className="inline-flex size-12 items-center justify-center rounded-full border-[1.5px] border-ink hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <ul
        ref={strip}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:none] lg:px-[max(1.5rem,calc((100vw-1180px)/2+2.5rem))] [&::-webkit-scrollbar]:hidden"
      >
        {FIRST_14_DAYS.map((task, i) => {
          const day = i + 1;
          const milestone = MILESTONES.has(day);
          return (
            <li
              key={day}
              className={cn(
                "flex w-[240px] shrink-0 snap-start flex-col justify-between gap-6 rounded-3xl p-6 select-none",
                milestone ? "bg-sand" : "border border-line bg-white",
              )}
            >
              <span
                className={cn(
                  "text-[13px] font-semibold tracking-[0.14em] uppercase",
                  milestone ? "text-rose-deep" : "text-ink-soft",
                )}
              >
                Ден {day}
              </span>
              <p
                className={cn(
                  "font-bold tracking-[-0.01em]",
                  milestone ? "text-2xl leading-snug" : "text-lg leading-snug",
                )}
              >
                {task}
              </p>
            </li>
          );
        })}
      </ul>
      <p className={`${WRAP} mt-4 text-[15px] text-ink-soft`}>
        Предизвикателството върви във всяко членство.
      </p>
    </section>
  );
}

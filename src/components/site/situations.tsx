"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { SITUATIONS, type Situation } from "@/lib/site/situations";
import { DISPLAY, WRAP } from "./styles";

const ROWS: { key: keyof Pick<Situation, "day" | "gets" | "startsWith">; label: string }[] = [
  { key: "day", label: "Денят ти" },
  { key: "gets", label: "Получаваш" },
  { key: "startsWith", label: "Започваш с" },
];

/** „За теб ли е?": pick your situation, read what the club looks like for exactly that. */
export function Situations() {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion() ?? false;
  const headingId = useId();
  const tiles = useRef<Array<HTMLButtonElement | null>>([]);
  const current = SITUATIONS[index]!;

  const move = (next: number) => {
    const i = (next + SITUATIONS.length) % SITUATIONS.length;
    setIndex(i);
    tiles.current[i]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(SITUATIONS.length - 1);
    }
  };

  return (
    <section id="za-teb" className={`${WRAP} py-20 lg:py-28`}>
      <h2 id={headingId} className={`${DISPLAY} text-4xl sm:text-[56px]`}>
        За теб ли е?
      </h2>
      <p className="mt-3 text-lg text-ink-soft">Докосни това, което е най-близо до теб.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-12">
        <div
          role="radiogroup"
          aria-labelledby={headingId}
          className="grid gap-3 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1"
        >
          {SITUATIONS.map((s, i) => {
            const selected = i === index;
            return (
              <button
                key={s.id}
                ref={(el) => {
                  tiles.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setIndex(i)}
                onKeyDown={onKeyDown}
                className={cn(
                  "flex min-h-16 items-center justify-between gap-4 rounded-2xl border-[1.5px] px-5 py-4 text-left text-lg font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  selected
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-white text-ink hover:bg-sand",
                )}
              >
                {s.label}
                <span
                  aria-hidden
                  className={cn("size-3 shrink-0 rounded-full", selected ? "bg-powder" : "bg-line")}
                />
              </button>
            );
          })}
        </div>

        <div className="rounded-3xl bg-sand p-7 sm:p-9 lg:col-span-7">
          <AnimatePresence mode="wait" initial={false}>
            <motion.dl
              key={current.id}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="grid gap-6"
            >
              {ROWS.map((row) => (
                <div key={row.key}>
                  <dt className="text-[13px] font-semibold tracking-[0.14em] text-rose-deep uppercase">
                    {row.label}
                  </dt>
                  <dd className="mt-1.5 text-xl leading-snug font-semibold sm:text-2xl">
                    {current[row.key]}
                  </dd>
                </div>
              ))}
            </motion.dl>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

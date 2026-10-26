"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { PHOTOS } from "@/lib/photos";
import { PhoneFrame } from "./phone-frame";
import { SCREENS } from "./screens";
import { DISPLAY, WRAP } from "./styles";

const TABS = [
  {
    id: "workouts",
    label: "Тренировки",
    rows: [
      "Нова всеки делничен ден",
      "Три нива: начинаеща, напреднала, про",
      "Библиотека по фокус и дължина",
    ],
    screen: SCREENS.insideWorkouts,
    alt: "Екранът „Тренировки“ с филтри и видеа",
  },
  {
    id: "nutrition",
    label: "Хранене",
    rows: [
      "Дневна цел, сметната за теб",
      "Дневник с думи, не с грамове",
      "Меню с рецепти за 15 минути",
    ],
    screen: SCREENS.insideNutrition,
    alt: "Екранът „Хранене“ с дневния кръг калории",
  },
  {
    id: "challenges",
    label: "Предизвикателства",
    rows: [
      "Първите 14 дни с общ старт",
      "Точки, нива и класация",
      "Споделяш финала с баджа на клуба",
    ],
    screen: SCREENS.insideChallenges,
    alt: "Екранът „Предизвикателства“ с текущото предизвикателство",
  },
  {
    id: "live",
    label: "На живо",
    rows: ["Веднъж седмично с Аксения в реално време", "Остава на запис", "Питаш, тя отговаря"],
    screen: null,
    alt: PHOTOS.step1.alt,
  },
] as const;

/** „Какво има вътре": four tabs, each with three check rows and a real screen. */
export function InsideTabs() {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion() ?? false;
  const baseId = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = TABS[index]!;

  const move = (next: number) => {
    const i = (next + TABS.length) % TABS.length;
    setIndex(i);
    tabs.current[i]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(TABS.length - 1);
    }
  };

  return (
    <section id="vatre" className="scroll-mt-20 bg-sand py-20 lg:py-28">
      <div className={WRAP}>
        <h2 className={`${DISPLAY} text-4xl sm:text-[56px]`}>Какво има вътре</h2>

        <div
          role="tablist"
          aria-label="Какво има вътре"
          className="mt-8 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t, i) => {
            const selected = i === index;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setIndex(i)}
                onKeyDown={onKeyDown}
                className={cn(
                  "inline-flex min-h-12 shrink-0 snap-start items-center rounded-full px-5 text-[15px] font-bold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  selected ? "bg-ink text-white" : "bg-white text-ink hover:bg-powder-chip",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            role="tabpanel"
            id={`${baseId}-panel-${current.id}`}
            aria-labelledby={`${baseId}-tab-${current.id}`}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-10 grid items-center gap-10 lg:grid-cols-12 lg:gap-12"
          >
            <div className="lg:col-span-6">
              <h3 className="text-3xl font-extrabold tracking-[-0.02em] sm:text-4xl">
                {current.label}
              </h3>
              <ul className="mt-6 flex flex-col gap-4">
                {current.rows.map((row) => (
                  <li key={row} className="flex items-start gap-3 text-lg">
                    <span className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-powder text-ink">
                      <Check size={14} strokeWidth={3} aria-hidden="true" />
                    </span>
                    {row}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-6">
              {current.screen ? (
                <PhoneFrame src={current.screen} alt={current.alt} />
              ) : (
                <div className="relative mx-auto aspect-[4/5] w-full max-w-[380px] overflow-hidden rounded-3xl bg-white">
                  <Image
                    src={PHOTOS.step1.src}
                    alt={PHOTOS.step1.alt}
                    fill
                    sizes="380px"
                    className="object-cover"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

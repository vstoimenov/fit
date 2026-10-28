"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PhoneFrame } from "./phone-frame";
import { SCREENS } from "./screens";
import { DISPLAY, WRAP } from "./styles";

const STEPS = [
  {
    n: "01",
    title: "Профил и 7 въпроса",
    body: "Имейл и телефон, после цел, ниво и колко време имаш. Получаваш план и безплатна първа тренировка.",
    screen: SCREENS.step1,
    alt: "Въпросникът: „Какво искаш да постигнеш?“",
  },
  {
    n: "02",
    title: "Тренираш 20 минути",
    body: "Всеки делничен ден нова тренировка, в хола, с килимче. Три нива на трудност.",
    screen: SCREENS.step2,
    alt: "Екранът „Начало“ с днешната тренировка",
  },
  {
    n: "03",
    title: "Виждаш как растеш",
    body: "Точки, нива, снимки на прогреса и измерване веднъж месечно.",
    screen: SCREENS.step3,
    alt: "Екранът „Прогрес“ с графика на теглото",
  },
] as const;

/** Three steps; on desktop one phone swaps its screen to the step currently in view. */
export function HowItWorks() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion() ?? false;
  const refs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const items = refs.current.filter((el): el is HTMLLIElement => el !== null);
    if (items.length === 0) return;
    // The most visible step wins, so two steps on screen at once do not flicker.
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(Number((e.target as HTMLElement).dataset.index), e.intersectionRatio);
        }
        let best = -1;
        let bestRatio = 0;
        for (const [i, r] of ratios) {
          if (r > bestRatio) {
            best = i;
            bestRatio = r;
          }
        }
        if (best >= 0 && bestRatio >= 0.6) setActive(best);
      },
      { threshold: [0.6, 0.8, 1] },
    );
    for (const el of items) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="kak-raboti" className={`${WRAP} scroll-mt-20 py-20 lg:py-28`}>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          <h2 className={`${DISPLAY} text-4xl sm:text-[56px] lg:sticky lg:top-28`}>Как работи</h2>
        </div>

        <ol className="flex flex-col gap-10 lg:col-span-4 lg:gap-32 lg:py-10">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-index={i}
              className="grid gap-6"
            >
              <div>
                <p className="text-[13px] font-semibold tracking-[0.14em] text-rose-deep">{s.n}</p>
                <h3 className="mt-2 text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
                  {s.title}
                </h3>
                <p className="mt-3 text-lg leading-relaxed text-ink-soft">{s.body}</p>
              </div>
              <PhoneFrame src={s.screen} alt={s.alt} className="lg:hidden" />
            </li>
          ))}
        </ol>

        <div className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-24">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <PhoneFrame src={STEPS[active]!.screen} alt={STEPS[active]!.alt} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

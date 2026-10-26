"use client";

import { animate, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { DAYS, MINUTES, timePlan } from "@/lib/site/time-plan";
import { CTA, CTA_PRIMARY, DISPLAY, WRAP } from "./styles";

const RANGE =
  "h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink";

/** A number that tweens to its new value over 200 ms (instant under reduced motion). */
function Tween({ value }: { value: number }) {
  const reduced = useReducedMotion() ?? false;
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (reduced || from === value) {
      setShown(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.2,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduced]);
  return <>{shown}</>;
}

/** „Колко време имаш?": two sliders, honest arithmetic, a link into the quiz with the values. */
export function TimePlanCalculator() {
  const [minutes, setMinutes] = useState<number>(MINUTES.start);
  const [days, setDays] = useState<number>(DAYS.start);
  const id = useId();
  const plan = timePlan(minutes, days);
  // Screen readers hear the settled result once per change, not every tween frame.
  const [settled, setSettled] = useState(plan);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(timePlan(minutes, days)), 400);
    return () => clearTimeout(timer);
  }, [minutes, days]);

  return (
    <section id="vreme" className={`${WRAP} scroll-mt-20 py-20 lg:py-28`}>
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-5">
          <h2 className={`${DISPLAY} text-4xl sm:text-[56px]`}>Колко време имаш?</h2>
          <p className="mt-4 text-lg text-ink-soft">
            Плъзни и виж какво получаваш за 30 дни. Без обещания за килограми, само сметка.
          </p>

          <div className="mt-10 flex flex-col gap-8">
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <label htmlFor={`${id}-min`} className="font-bold">
                  Минути на ден
                </label>
                <span className="text-2xl font-extrabold tracking-[-0.02em]">{plan.minutes}</span>
              </div>
              <input
                id={`${id}-min`}
                type="range"
                min={MINUTES.min}
                max={MINUTES.max}
                step={MINUTES.step}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className={RANGE}
              />
            </div>
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <label htmlFor={`${id}-days`} className="font-bold">
                  Дни в седмицата
                </label>
                <span className="text-2xl font-extrabold tracking-[-0.02em]">{plan.days}</span>
              </div>
              <input
                id={`${id}-days`}
                type="range"
                min={DAYS.min}
                max={DAYS.max}
                step={1}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className={RANGE}
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-sand p-7 sm:p-9 lg:col-span-7">
          <p aria-live="polite" aria-atomic="true" className="sr-only">
            Около {settled.weeklyMinutes} минути на седмица, {settled.workoutsPer30Days} тренировки
            за 30 дни, тренировки {settled.lengthLabel}, ниво {settled.levelLabel}.
          </p>
          <dl className="grid gap-6 sm:grid-cols-2" aria-hidden="true">
            <div>
              <dt className="text-[13px] font-semibold tracking-[0.14em] text-rose-deep uppercase">
                На седмица
              </dt>
              <dd className="mt-1 text-4xl font-extrabold tracking-[-0.03em]">
                ≈ <Tween value={plan.weeklyMinutes} /> мин.
              </dd>
            </div>
            <div>
              <dt className="text-[13px] font-semibold tracking-[0.14em] text-rose-deep uppercase">
                За 30 дни
              </dt>
              <dd className="mt-1 text-4xl font-extrabold tracking-[-0.03em]">
                ≈ <Tween value={plan.workoutsPer30Days} /> тренировки
              </dd>
            </div>
            <div>
              <dt className="text-[13px] font-semibold tracking-[0.14em] text-rose-deep uppercase">
                Твоите тренировки
              </dt>
              <dd className="mt-1 text-2xl font-extrabold tracking-[-0.02em]">
                {plan.lengthLabel}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] font-semibold tracking-[0.14em] text-rose-deep uppercase">
                Ниво за старт
              </dt>
              <dd className="mt-1 text-2xl font-extrabold tracking-[-0.02em]">{plan.levelLabel}</dd>
            </div>
          </dl>
          <Link
            href={`/start?minutes=${plan.minutes}&days=${plan.days}`}
            className={`${CTA} ${CTA_PRIMARY} mt-8`}
          >
            Вземи плана си
          </Link>
        </div>
      </div>
    </section>
  );
}

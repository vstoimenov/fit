"use client";

import { CalendarDays, Check, Dumbbell, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { cardAdvice, cardSavings, dropInAdvice, eur, perTraining } from "@/lib/studio/pricing";
import { DROP_IN_PRICE_EUR, STUDIO_CARDS, type CardKind } from "@/lib/studio/rules";

type Option = "drop" | CardKind;

const OPTIONS: {
  key: Option;
  title: string;
  price: number;
  perTraining: number;
  savings: number | null;
  validity: string;
}[] = [
  {
    key: "drop",
    title: "Еднократна",
    price: DROP_IN_PRICE_EUR,
    perTraining: DROP_IN_PRICE_EUR,
    savings: null,
    validity: "за една тренировка",
  },
  ...(["card8", "card12"] as const).map((k) => ({
    key: k,
    title: STUDIO_CARDS[k].label,
    price: STUDIO_CARDS[k].priceEur,
    perTraining: perTraining(k),
    savings: cardSavings(k),
    validity: `важи ${STUDIO_CARDS[k].weeks} седмици`,
  })),
];

const PER_WEEK = [1, 2, 3, 4] as const;

/** The price list as three cards she can tap, plus „колко пъти седмично?“ to see what fits her. */
export function PriceCards() {
  const [picked, setPicked] = useState<Option>("card12");
  const [perWeek, setPerWeek] = useState<number>(2);
  const advice = picked === "drop" ? dropInAdvice(perWeek) : cardAdvice(picked, perWeek);
  const current = OPTIONS.find((o) => o.key === picked)!;

  return (
    <section aria-labelledby="prices" className="space-y-6">
      <h2 id="prices" className="text-xl font-bold">
        Цени
      </h2>
      <div
        className="grid grid-cols-3 gap-2 pt-3 sm:gap-3"
        role="radiogroup"
        aria-label="Избери карта"
      >
        {OPTIONS.map((o) => {
          const active = o.key === picked;
          const best = o.key === "card12";
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPicked(o.key)}
              className={cn(
                "relative flex flex-col gap-1.5 rounded-2xl p-3 text-left sm:gap-3 sm:rounded-3xl sm:p-5 transition-[transform,box-shadow,background-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none",
                active
                  ? "scale-[1.02] bg-ink text-white shadow-lg motion-reduce:scale-100"
                  : "bg-white ring-1 ring-line hover:-translate-y-0.5 hover:ring-ink/30 motion-reduce:hover:translate-y-0",
              )}
            >
              {best && (
                <span
                  className={cn(
                    "absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold sm:left-auto sm:right-4 sm:translate-x-0 sm:px-3 sm:py-1 sm:text-xs",
                    active ? "bg-powder text-ink" : "bg-rose-deep text-white",
                  )}
                >
                  <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
                  Най-изгодна
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs font-semibold sm:gap-2 sm:text-sm">
                {o.key === "drop" ? (
                  <Dumbbell className="hidden h-4 w-4 sm:block" aria-hidden />
                ) : (
                  <CalendarDays className="hidden h-4 w-4 sm:block" aria-hidden />
                )}
                {o.title}
              </span>
              <span className="text-2xl font-extrabold tracking-[-0.03em] sm:text-4xl">
                {eur(o.price)}
              </span>
              <span
                className={cn("text-xs sm:text-sm", active ? "text-white/80" : "text-ink-soft")}
              >
                {eur(o.perTraining)}
                <span className="hidden sm:inline"> на тренировка · {o.validity}</span>
                <span className="sm:hidden"> / тренировка</span>
              </span>
              {o.savings !== null ? (
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold sm:px-3 sm:py-1 sm:text-xs",
                    active ? "bg-white/15 text-white" : "bg-powder-light text-rose-deep",
                  )}
                >
                  <Check className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
                  Спестяваш {eur(o.savings)}
                </span>
              ) : (
                <span
                  className={cn(
                    "text-xs font-semibold",
                    active ? "text-white/70" : "text-ink-soft",
                  )}
                >
                  Без карта
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-3xl bg-sand p-5">
        <p className="text-sm font-semibold">Колко пъти седмично ще тренираш?</p>
        <div className="flex gap-2" role="radiogroup" aria-label="Тренировки седмично">
          {PER_WEEK.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === perWeek}
              onClick={() => setPerWeek(n)}
              className={cn(
                "h-11 min-w-11 flex-1 rounded-full text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                n === perWeek ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-line",
              )}
            >
              {n === 4 ? "4+" : n}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="leading-relaxed">
          <span className="font-bold">
            {current.title} · {eur(current.price)} · {current.validity}
          </span>
          <br />
          {advice}
        </p>
        <p className="text-xs text-ink-soft">
          Плащаш на място при Аксения. Посещението се отчита при записване, отказ до 6 часа преди
          началото.
        </p>
      </div>
    </section>
  );
}

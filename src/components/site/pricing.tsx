"use client";

import { Gift } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { pickPlan, yearlySavings } from "@/lib/site/pricing";
import type { PublicPlan } from "@/server/content/public-plans";
import { CTA, CTA_SECONDARY, DISPLAY, EYEBROW, WRAP } from "./styles";

type Period = "month" | "year";

/** Monthly / yearly card from the live `plans` table, plus the gift voucher card. */
export function Pricing({ plans }: { plans: PublicPlan[] }) {
  const month = plans.find((p) => p.interval === "month");
  const year = plans.find((p) => p.interval === "year");
  const [period, setPeriod] = useState<Period>("month");
  const id = useId();
  const savings = yearlySavings(month?.price_cents, year?.price_cents);
  const shown = pickPlan(plans, period);
  const currency = shown?.currency ?? "EUR";

  return (
    <section id="ceni" className={`${WRAP} scroll-mt-20 py-20 lg:py-28`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <h2 className={`${DISPLAY} text-4xl sm:text-[56px]`}>Прости цени</h2>
        {month && year && (
          <div
            role="radiogroup"
            aria-labelledby={`${id}-toggle`}
            className="inline-flex rounded-full bg-sand p-1"
          >
            <span id={`${id}-toggle`} className="sr-only">
              Период на плащане
            </span>
            {(["month", "year"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={period === v}
                onClick={() => setPeriod(v)}
                className={cn(
                  "min-h-11 rounded-full px-5 text-[15px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  period === v ? "bg-ink text-white" : "text-ink hover:bg-white",
                )}
              >
                {v === "month" ? "Месечно" : "Годишно"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {shown && (
          <div className="flex flex-col gap-6 rounded-3xl bg-ink p-8 text-white lg:col-span-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className={cn(EYEBROW, "text-[#BDBBB4]")}>
                {shown.interval === "month" ? "Месечно членство" : "Годишно членство"}
              </p>
              <p className="mt-3 text-5xl font-extrabold tracking-[-0.03em] sm:text-6xl">
                {formatPrice(shown.price_cents, currency)}
                <span className="ml-2 text-lg font-semibold text-[#BDBBB4]">
                  / {shown.interval === "month" ? "месец" : "година"}
                </span>
              </p>
              {shown.interval === "year" && savings ? (
                <p className="mt-3 text-lg">
                  ≈ {formatPrice(savings.perMonthCents, currency)} на месец ·{" "}
                  <span className="rounded-lg bg-powder px-2 py-0.5 font-bold text-ink">
                    спестяваш {formatPrice(savings.savesCents, currency)}
                  </span>
                </p>
              ) : (
                <p className="mt-3 text-lg text-[#DDD]">Спираш когато искаш.</p>
              )}
            </div>
            <Link href="/start" className={`${CTA} bg-white text-ink hover:bg-sand`}>
              Започни
            </Link>
          </div>
        )}

        <div className="flex flex-col justify-between gap-6 rounded-3xl bg-powder-light p-8">
          <div>
            <p className={cn(EYEBROW, "flex items-center gap-2 text-rose-deep")}>
              <Gift size={16} aria-hidden="true" /> Подари
            </p>
            <p className="mt-3 text-3xl font-extrabold tracking-[-0.02em]">от €29</p>
            <p className="mt-3 text-[15px] leading-relaxed text-rose-deep">
              Ваучер за 1, 3 или 12 месеца. Получаваш картичка за печат и код, който тя активира,
              когато е готова.
            </p>
          </div>
          <Link href="/podari" className={`${CTA} ${CTA_SECONDARY} bg-white`}>
            Избери подарък
          </Link>
        </div>
      </div>

      {!shown && <p className="mt-6 text-lg text-ink-soft">Цените се обявяват скоро.</p>}

      <div className="mt-8 flex flex-col gap-3 text-[15px] text-ink-soft">
        <p>
          Във всяко членство: нова тренировка всеки делничен ден, три нива, хранене с менюта,
          предизвикателства, Аксения на живо всяка седмица и на запис.
        </p>
        <p>
          <span className="font-bold text-ink">14 дни гаранция:</span> тренирай 10 от първите 14 дни
          и ако не се чувстваш по-силна, връщаме парите.
        </p>
        <p className="text-sm">
          Плащане с карта, Apple Pay или Google Pay. Абонаментът се подновява сам; спираш го от
          профила си.
        </p>
      </div>
    </section>
  );
}

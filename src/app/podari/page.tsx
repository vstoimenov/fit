import { Check } from "lucide-react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { CTA, CTA_PRIMARY, DISPLAY, EYEBROW, WRAP } from "@/components/site/styles";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { GIFT_OPTIONS, giftMonthsLabel } from "@/lib/site/gift";
import { serverEnv } from "@/env";
import { getSiteFlags, getSiteLinks } from "@/server/site/content";
import { GiftOrderForm } from "./gift-order-form";
import { PickGift } from "./pick-gift";

export const metadata = {
  title: "Подари членство",
  description: "Подаръчен ваучер за I AM STRONG: 1, 3 или 12 месеца тренировки у дома.",
};

const INCLUDED = [
  "Нова тренировка всеки делничен ден, три нива",
  "Хранене с менюта и предизвикателства",
  "Аксения на живо всяка седмица и на запис",
  "Картичка за печат + код по имейл до 5 минути",
  "Кодът се активира, когато тя е готова; важи 12 месеца",
];

/** Gift voucher: the three options and, once Stripe is configured, the order form. */
export default async function GiftPage() {
  const [links, flags] = await Promise.all([getSiteLinks(), getSiteFlags()]);
  // Build-time: adding the keys means a redeploy anyway. The action re-checks the live provider.
  const ready = Boolean(serverEnv.STRIPE_SECRET_KEY && serverEnv.STRIPE_WEBHOOK_SECRET);
  return (
    <>
      <SiteHeader showFounders={flags.showFounders} />
      <main className={`${WRAP} py-12 lg:py-20`}>
        <p className={`${EYEBROW} text-rose-deep`}>Подаръчен ваучер</p>
        <h1 className={`${DISPLAY} mt-3 text-[44px] sm:text-7xl`}>Подари сила.</h1>
        <p className="mt-5 max-w-2xl text-xl leading-relaxed">
          Членство в клуба за жена, която все отлага себе си. Ти избираш колко месеца, тя избира
          кога да започне.
        </p>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {GIFT_OPTIONS.map((o) => {
            const best = o.months === 12;
            return (
              <div
                key={o.months}
                className={cn(
                  "flex flex-col gap-6 rounded-3xl p-8",
                  best ? "bg-ink text-white" : "border border-line bg-white",
                )}
              >
                <div>
                  <p className={cn(EYEBROW, best ? "text-white/70" : "text-ink-soft")}>
                    {giftMonthsLabel(o.months)}
                  </p>
                  <p className="mt-3 flex items-baseline gap-3">
                    <span className="text-5xl font-extrabold tracking-[-0.03em]">
                      {formatPrice(o.priceCents, "EUR")}
                    </span>
                    {"regularCents" in o && (
                      <s
                        className={cn(
                          "text-lg font-semibold",
                          best ? "text-white/70" : "text-ink-soft",
                        )}
                      >
                        {formatPrice(o.regularCents, "EUR")}
                      </s>
                    )}
                  </p>
                </div>
                <ul className="flex flex-col gap-3">
                  {INCLUDED.map((line) => (
                    <li key={line} className="flex items-start gap-3 text-[15px] leading-snug">
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-powder text-ink">
                        <Check size={12} strokeWidth={3} aria-hidden="true" />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-col gap-2">
                  {ready ? (
                    <PickGift months={o.months} onInk={best} />
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled
                        aria-describedby="gift-soon"
                        className={cn(
                          CTA,
                          best ? "bg-white text-ink" : CTA_PRIMARY,
                          "disabled:cursor-not-allowed disabled:opacity-50",
                        )}
                      >
                        Купи ваучер
                      </button>
                      <Chip tone="powder" className="w-fit">
                        Скоро
                      </Chip>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {ready ? (
          <div className="mt-12">
            <GiftOrderForm />
          </div>
        ) : (
          <p id="gift-soon" className="mt-6 text-[15px] text-ink-soft">
            Плащанията се включват скоро. Дотогава пиши ни на имейла в долния край на страницата.
          </p>
        )}
        <p className="mt-8 text-[15px] text-ink-soft">
          Вече имаш код? Влез в профила си и го въведи в „Моят план“.
        </p>
      </main>
      <SiteFooter instagramUrl={links.instagramUrl} year={flags.year} />
    </>
  );
}

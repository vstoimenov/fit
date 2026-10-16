import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { formatPrice } from "@/lib/format";

export type LandingPlan = {
  id: string;
  name: string;
  interval: "month" | "year";
  price_cents: number;
  currency: string;
};

/** `plans` is null when the prices could not be read: the section then renders without amounts. */
export function Pricing({ plans }: { plans: LandingPlan[] | null }) {
  const shown = plans && plans.length > 0 ? plans : null;
  return (
    <section
      aria-labelledby="price-title"
      className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16"
    >
      <h2 id="price-title" className="font-display text-3xl font-extrabold text-balance">
        Цена
      </h2>
      <p className="mt-2 text-ink-soft">
        Първата тренировка е безплатна. Планът ти трябва едва след нея.
      </p>
      {shown ? (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {shown.map((plan) => (
            <li key={plan.id}>
              <Card className="h-full space-y-2 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl font-extrabold">{plan.name}</h3>
                  {plan.interval === "year" && <Chip tone="powder">Най-изгодно</Chip>}
                </div>
                <p className="font-display text-4xl font-extrabold">
                  {formatPrice(plan.price_cents, plan.currency)}
                  <span className="text-base font-semibold text-ink-soft">
                    {" "}
                    / {plan.interval === "month" ? "месец" : "година"}
                  </span>
                </p>
                {plan.interval === "year" && (
                  <p className="text-ink-soft">
                    ≈ {formatPrice(Math.round(plan.price_cents / 12), plan.currency)} / месец
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mt-8 p-6">
          <p className="text-ink-soft">
            Цената на плана ще видиш в приложението, след първата тренировка.
          </p>
        </Card>
      )}
      <div className="mt-8">
        <Link href="/start" className={buttonClass("primary", "lg") + " w-full sm:w-auto"}>
          Започни безплатно
        </Link>
      </div>
    </section>
  );
}

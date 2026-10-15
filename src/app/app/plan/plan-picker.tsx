"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { startCheckoutAction } from "./actions";

type Plan = {
  id: string;
  name: string;
  interval: "month" | "year";
  price_cents: number;
  currency: string;
};

export function PlanPicker({ plans, ready }: { plans: Plan[]; ready: boolean }) {
  const [selected, setSelected] = useState(
    plans.find((p) => p.interval === "month")?.id ?? plans[0]?.id ?? "",
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function subscribe() {
    setError("");
    startTransition(async () => {
      const result = await startCheckoutAction(selected);
      if (!result.ok) return setError(result.message);
      window.location.assign(result.data.url);
    });
  }

  return (
    <section className="space-y-3">
      <div role="radiogroup" aria-label="Избери план" className="space-y-3">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            role="radio"
            aria-checked={selected === plan.id}
            onClick={() => setSelected(plan.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-3xl border-2 bg-white p-5 text-left",
              selected === plan.id ? "border-ink" : "border-line",
            )}
          >
            <span>
              <span className="block font-display text-lg font-bold">{plan.name}</span>
              {plan.interval === "year" && (
                <span className="text-sm text-moss">
                  {formatPrice(Math.round(plan.price_cents / 12), plan.currency)} на месец
                </span>
              )}
            </span>
            <span className="font-display text-xl font-bold">
              {formatPrice(plan.price_cents, plan.currency)}
              <span className="text-sm font-medium text-ink-soft">
                /{plan.interval === "month" ? "мес" : "год"}
              </span>
            </span>
          </button>
        ))}
      </div>
      <Button className="w-full" disabled={!ready || pending || !selected} onClick={subscribe}>
        {ready ? (pending ? "Пренасочване…" : "Абонирай се") : "Плащането се включва скоро"}
      </Button>
      <p className="text-center text-xs text-ink-soft">
        Плащане с карта, Apple Pay или Google Pay през Stripe. Можеш да откажеш по всяко време.
      </p>
      {error && (
        <p role="alert" className="text-center text-sm text-brick">
          {error}
        </p>
      )}
    </section>
  );
}

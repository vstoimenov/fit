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
  /** Has a price id for the active provider; computed on the server. */
  payable: boolean;
};

export function PlanPicker({ plans, ready }: { plans: Plan[]; ready: boolean }) {
  const payable = plans.filter((p) => p.payable);
  const [selected, setSelected] = useState(
    (payable.find((p) => p.interval === "month") ?? payable[0])?.id ?? "",
  );
  const [error, setError] = useState("");
  // Stays true after the redirect starts: the page is still visible while the browser navigates.
  const [redirecting, setRedirecting] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = pending || redirecting;

  function subscribe() {
    setError("");
    startTransition(async () => {
      const result = await startCheckoutAction(selected);
      if (!result.ok) return setError(result.message);
      setRedirecting(true);
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
            disabled={!plan.payable || busy}
            onClick={() => setSelected(plan.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-3xl border-2 bg-white p-5 text-left disabled:cursor-not-allowed",
              selected === plan.id ? "border-ink" : "border-line",
              !plan.payable && "opacity-50",
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
            <span className="text-right font-display text-xl font-bold">
              {formatPrice(plan.price_cents, plan.currency)}
              <span className="text-sm font-medium text-ink-soft">
                /{plan.interval === "month" ? "мес" : "год"}
              </span>
              {!plan.payable && (
                <span className="block text-xs font-semibold text-ink-soft">Скоро</span>
              )}
            </span>
          </button>
        ))}
      </div>
      <Button className="w-full" disabled={!ready || busy || !selected} onClick={subscribe}>
        {ready ? (busy ? "Пренасочване…" : "Абонирай се") : "Плащането се включва скоро"}
      </Button>
      <p className="text-center text-xs text-ink-soft">
        Плащане с карта, Apple Pay или Google Pay. Можеш да откажеш по всяко време.
      </p>
      {error && (
        <p role="alert" className="text-center text-sm text-brick">
          {error}
        </p>
      )}
    </section>
  );
}

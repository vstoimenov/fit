"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
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
        {plans.map((plan) => {
          const on = selected === plan.id;
          const disabled = !plan.payable || busy;
          return (
            <label
              key={plan.id}
              className={cn(
                "flex min-h-20 items-center gap-4 rounded-2xl border-[1.5px] p-5 text-left transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                on ? "border-ink bg-powder-light" : "border-line bg-white",
                disabled ? "cursor-not-allowed" : "cursor-pointer",
                !plan.payable && "opacity-50",
              )}
            >
              <input
                type="radio"
                name="plan"
                value={plan.id}
                checked={on}
                disabled={disabled}
                onChange={() => setSelected(plan.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  on ? "bg-ink text-white" : "border-[1.5px] border-line",
                )}
              >
                {on && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg">{plan.name}</span>
                  {plan.interval === "year" && <Chip tone="powder">Най-изгодно</Chip>}
                </span>
                {plan.interval === "year" && (
                  <span className="block text-sm text-ink-soft">
                    ≈ {formatPrice(Math.round(plan.price_cents / 12), plan.currency)} / месец
                  </span>
                )}
              </span>
              <span className="text-right font-display text-xl">
                {formatPrice(plan.price_cents, plan.currency)}
                <span className="text-sm font-semibold text-ink-soft">
                  /{plan.interval === "month" ? "мес" : "год"}
                </span>
                {!plan.payable && (
                  <span className="block text-xs font-semibold text-ink-soft">Скоро</span>
                )}
              </span>
            </label>
          );
        })}
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

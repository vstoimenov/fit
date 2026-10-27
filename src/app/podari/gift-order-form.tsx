"use client";

import { useActionState } from "react";
import { CTA, CTA_PRIMARY } from "@/components/site/styles";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { GIFT_OPTIONS, giftMonthsLabel } from "@/lib/site/gift";
import { startGiftCheckoutAction, type GiftOrderState } from "./actions";

const IDLE: GiftOrderState = { status: "idle" };

/** Pick a period, leave an e-mail for the code, go to Stripe. */
export function GiftOrderForm({ defaultMonths = 3 }: { defaultMonths?: number }) {
  const [state, action, pending] = useActionState(startGiftCheckoutAction, IDLE);
  // After an error the form keeps what she typed (React resets uncontrolled fields after an action).
  const values = state.status === "error" ? state.values : undefined;
  const checked = values ? Number(values.months) : defaultMonths;
  return (
    <form action={action} id="porachka" className="scroll-mt-24 rounded-3xl bg-sand p-6 sm:p-8">
      <h2 className="text-2xl font-extrabold tracking-[-0.02em]">Поръчай ваучер</h2>
      <p className="mt-2 text-ink-soft">
        Плащаш с карта; кодът и картичката за печат идват на твоя имейл до минути.
      </p>
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">Период</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {GIFT_OPTIONS.map((o) => (
            <label
              key={o.months}
              className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white px-4 ring-[1.5px] ring-line has-[:checked]:ring-ink"
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="months"
                  value={o.months}
                  id={`gift-m-${o.months}`}
                  defaultChecked={o.months === checked}
                  className="size-4 accent-ink"
                />
                <span className="font-semibold">{giftMonthsLabel(o.months)}</span>
              </span>
              <span className="font-extrabold">{formatPrice(o.priceCents, "EUR")}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Твоят имейл (за кода)">
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={values?.email}
            className={inputClass}
          />
        </Field>
        <Field label="За кого е (по избор)">
          <input
            name="recipientName"
            maxLength={60}
            defaultValue={values?.recipientName}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Пожелание на картичката (по избор)">
          <textarea
            name="message"
            maxLength={300}
            rows={2}
            defaultValue={values?.message}
            className={`${inputClass} h-auto py-3`}
          />
        </Field>
      </div>
      {state.status === "error" && (
        <p role="alert" className="mt-4 text-sm font-semibold text-brick">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={cn(CTA, CTA_PRIMARY, "mt-6 w-full sm:w-auto", "disabled:opacity-60")}
      >
        {pending ? "Момент…" : "Към плащане"}
      </button>
      <p className="mt-3 text-sm text-ink-soft">
        Кодът важи 12 месеца и се активира, когато тя е готова.
      </p>
    </form>
  );
}

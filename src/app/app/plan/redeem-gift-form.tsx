"use client";

import { Gift } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputOnCardClass } from "@/components/ui/field";
import { redeemGiftAction, type RedeemState } from "./gift-actions";

const IDLE: RedeemState = { status: "idle" };

/** „Имаш ваучер?" — the code from a gift card extends her access. */
export function RedeemGiftForm() {
  const [state, action, pending] = useActionState(redeemGiftAction, IDLE);
  const done = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "ok") done.current?.focus();
  }, [state.status]);
  if (state.status === "ok") {
    const until = new Date(state.periodEnd).toLocaleDateString("bg-BG", {
      timeZone: "Europe/Sofia",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return (
      <Card ref={done} tabIndex={-1} className="space-y-3 p-5 outline-none" role="status">
        <p className="flex items-center gap-2 font-semibold">
          <Gift size={20} aria-hidden="true" />
          Ваучерът е активиран
        </p>
        <p className="text-ink-soft">Членството ти е активно до {until}</p>
        <Link href="/app" className={`${buttonClass("primary", "md")} w-full`}>
          Към тренировките
        </Link>
      </Card>
    );
  }
  return (
    <Card className="space-y-3 p-5">
      <form action={action} className="space-y-3">
        <label className="block space-y-2">
          <span className="flex items-center gap-2 font-semibold">
            <Gift size={20} aria-hidden="true" />
            Имаш подаръчен ваучер?
          </span>
          <input
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="IAM-XXXXX-XXXXX"
            maxLength={20}
            required
            className={inputOnCardClass}
            defaultValue={state.status === "error" ? state.code : undefined}
            aria-invalid={state.status === "error" || undefined}
            aria-describedby={state.status === "error" ? "gift-code-error" : undefined}
          />
        </label>
        {state.status === "error" && (
          <p id="gift-code-error" role="alert" className="text-sm font-semibold text-brick">
            {state.message}
          </p>
        )}
        <Button type="submit" variant="secondary" size="md" disabled={pending} className="w-full">
          {pending ? "Момент…" : "Активирай"}
        </Button>
      </form>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { submitLeadAction, type LeadState } from "@/server/leads/action";
import { CTA, CTA_PRIMARY } from "./styles";

export const LEAD_STORAGE_KEY = "iamstrong.lead";

const IDLE: LeadState = { status: "idle" };

/** Name + e-mail in exchange for the free workout. Calls `onUnlocked` once the lead is stored. */
export function LeadForm({ onUnlocked }: { onUnlocked: (name: string) => void }) {
  const [state, action, pending] = useActionState(submitLeadAction, IDLE);
  const alertRef = useRef<HTMLParagraphElement>(null);
  // After an error the form keeps what she typed (React resets uncontrolled fields after an action).
  const values = state.status === "error" ? state.values : undefined;

  useEffect(() => {
    if (state.status === "error") alertRef.current?.focus();
  }, [state]);

  useEffect(() => {
    if (state.status !== "ok") return;
    try {
      localStorage.setItem(LEAD_STORAGE_KEY, "1");
    } catch {
      // Private mode or blocked storage: the unlock still works for this visit.
    }
    onUnlocked(state.name ?? "");
  }, [state, onUnlocked]);

  return (
    <form action={action} className="flex flex-col gap-4" aria-describedby="lead-help">
      <Field label="Име">
        <input
          name="name"
          type="text"
          autoComplete="given-name"
          required
          minLength={2}
          maxLength={60}
          defaultValue={values?.name}
          className={inputClass}
        />
      </Field>
      <Field label="Имейл">
        <input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={values?.email}
          className={inputClass}
        />
      </Field>
      {/* Honeypot: hidden from people, filled by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-3 text-[15px] leading-snug">
        <input
          name="marketing"
          type="checkbox"
          defaultChecked={values?.marketing}
          className="mt-1 size-4 shrink-0 accent-ink"
        />
        <span>
          Искам и съветите на Аксения за старта (1–2 имейла седмично; отписване с един клик).
        </span>
      </label>
      {state.status === "error" && (
        <p
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className="text-sm font-semibold text-brick focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={cn(CTA, CTA_PRIMARY, "disabled:opacity-60")}
      >
        {pending ? "Момент…" : "Отключи тренировката"}
      </button>
      <p id="lead-help" className="text-sm text-ink-soft">
        Ще ти пратим и линк към нея по имейл, за да я пуснеш, когато ти е удобно.{" "}
        <Link href="/privacy" className="underline underline-offset-4">
          Поверителност
        </Link>
      </p>
    </form>
  );
}

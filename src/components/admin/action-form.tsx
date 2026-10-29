"use client";

import { unstable_rethrow } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/** An action may return `{ message }` to say more than the fixed success text (e.g. a link). */
const successText = (data: unknown): string | null =>
  typeof data === "object" &&
  data !== null &&
  typeof (data as { message?: unknown }).message === "string"
    ? (data as { message: string }).message
    : null;

type FormAction = (
  prev: ActionResult<unknown> | null,
  form: FormData,
) => Promise<ActionResult<unknown>>;

/**
 * A form bound to a server action; shows the action's success or error message.
 * Submits through onSubmit rather than `<form action>` so React does not reset the
 * uncontrolled fields after a failed submit: the admin keeps what she typed.
 */
export function ActionForm({
  action,
  submitLabel,
  successMessage = "Запазено ✓",
  resetOnSuccess = false,
  submitVariant = "primary",
  submitAriaLabel,
  confirmMessage,
  className,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  /** `secondary` for a form that sits beside the screen's main save button. */
  submitVariant?: "primary" | "secondary";
  /** Accessible name for a button whose visible label repeats across a list. */
  submitAriaLabel?: string;
  /** Ask the browser to confirm before submitting. */
  confirmMessage?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ActionResult<unknown> | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    if (confirmMessage && !confirm(confirmMessage)) return;
    inFlight.current = true;
    const form = event.currentTarget;
    const data = new FormData(form);
    const previous = state;
    setState(null);
    startTransition(async () => {
      try {
        const result = await action(previous, data);
        setState(result);
        if (result.ok && resetOnSuccess) form.reset();
      } catch (error) {
        // Let Next's redirect/notFound control flow through; anything else is a real failure:
        // keep what was typed and show an inline error.
        unstable_rethrow(error);
        console.error("admin action failed", error);
        setState({ ok: false, message: "Нещо се обърка. Опитай отново." });
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className={className ?? "space-y-3"}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant={submitVariant}
          size="md"
          disabled={pending}
          aria-label={submitAriaLabel}
        >
          {pending ? "Запазване…" : submitLabel}
        </Button>
        {state?.ok && (
          <p role="status" className="text-sm break-all text-moss">
            {successText(state.data) ?? successMessage}
          </p>
        )}
        {state && !state.ok && (
          <p role="alert" className="text-sm text-brick">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

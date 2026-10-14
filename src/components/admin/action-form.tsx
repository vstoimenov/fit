"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

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
  className,
  children,
}: {
  action: FormAction;
  submitLabel: string;
  successMessage?: string;
  resetOnSuccess?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<ActionResult<unknown> | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
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
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className={className ?? "space-y-3"}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "Запазване…" : submitLabel}
        </Button>
        {state?.ok && (
          <p role="status" className="text-sm text-moss">
            {successMessage}
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

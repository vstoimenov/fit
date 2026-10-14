"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

type FormAction = (
  prev: ActionResult<unknown> | null,
  form: FormData,
) => Promise<ActionResult<unknown>>;

/** A form bound to a server action; shows the action's success or error message. */
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
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={formRef} action={formAction} className={className ?? "space-y-3"}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="md" disabled={pending}>
          {pending ? "…" : submitLabel}
        </Button>
        {state && (
          <p role="status" className={state.ok ? "text-sm text-moss" : "text-sm text-brick"}>
            {state.ok ? successMessage : state.message}
          </p>
        )}
      </div>
    </form>
  );
}

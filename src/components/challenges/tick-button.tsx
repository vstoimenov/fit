"use client";

import { Check } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The „Направих го“ toggle of a day: pressed (with a check) once the day is done. Primary only where it is the screen's one main action (today's
 * task on the detail page); everywhere else it is the quiet secondary kind.
 */
export function TickButton({
  done,
  pending,
  onToggle,
  label,
  primary = false,
  size = "lg",
  className,
}: {
  done: boolean;
  pending: boolean;
  onToggle: () => void;
  /** Names the day for screen readers when several buttons share the page; starts with the visible text. */
  label?: string;
  primary?: boolean;
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={label}
      disabled={pending}
      onClick={onToggle}
      className={cn(buttonClass(primary && !done ? "primary" : "secondary", size), className)}
    >
      {done && <Check size={size === "lg" ? 20 : 18} strokeWidth={2.25} aria-hidden="true" />}
      Направих го
    </button>
  );
}

/**
 * The live region for a tick: „+5 точки“ after a first tick and the error after a refused one. It
 * stays mounted, so screen readers announce the text when it appears.
 */
export function TickStatus({ toast, error }: { toast: string; error: string }) {
  return (
    <div>
      <p role="status" aria-live="polite" className="text-sm font-extrabold text-rose-deep">
        {toast}
      </p>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brick">
          {error}
        </p>
      )}
    </div>
  );
}

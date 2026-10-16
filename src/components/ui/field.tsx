import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "h-12 w-full rounded-2xl border-2 border-transparent bg-sand px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-soft/70 focus:border-ink focus-visible:ring-2 focus-visible:ring-ink/20";

/** Inputs inside a sand `Card` turn white, or they would vanish into the card. */
export const inputOnCardClass = cn(inputClass, "border-line bg-white focus:border-ink");

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {error ? (
        <span className="block text-sm text-brick">{error}</span>
      ) : hint ? (
        <span className="block text-sm text-ink-soft">{hint}</span>
      ) : null}
    </label>
  );
}

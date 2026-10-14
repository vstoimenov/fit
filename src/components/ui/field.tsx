import type { ReactNode } from "react";

export const inputClass =
  "h-14 w-full rounded-2xl border-2 border-line bg-white px-4 text-base text-ink outline-none transition-colors placeholder:text-ink-soft/60 focus:border-ink";

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

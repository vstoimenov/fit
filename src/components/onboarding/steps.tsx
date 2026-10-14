"use client";

import { cn } from "@/lib/cn";

/** One big tappable card per option. */
export function ChoiceList<T extends string>({
  options,
  labels,
  value,
  onChange,
  multiple = false,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | T[] | undefined;
  onChange: (next: T | T[]) => void;
  multiple?: boolean;
}) {
  const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
  function toggle(option: T) {
    if (!multiple) return onChange(option);
    const next = new Set(selected);
    if (next.has(option)) next.delete(option);
    else next.add(option);
    onChange([...next]);
  }
  return (
    <div className="grid gap-3">
      {options.map((option) => {
        const on = selected.has(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(option)}
            className={cn(
              "flex min-h-16 items-center justify-between rounded-3xl border-2 px-5 text-left text-lg font-semibold transition-all active:scale-[0.98]",
              on ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink",
            )}
          >
            {labels[option]}
            <span
              className={cn(
                "h-6 w-6 rounded-full border-2",
                on ? "border-paper bg-ember" : "border-line",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

/** A large number with a slider under it. */
export function NumberSlider({
  label,
  unit,
  min,
  max,
  step = 1,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{label}</span>
        <span className="font-display text-4xl font-bold tabular-nums">
          {value}
          <span className="ml-1 text-base font-medium text-ink-soft">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-ember)]"
        aria-label={label}
      />
    </div>
  );
}

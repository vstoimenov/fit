"use client";

import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/**
 * One big tappable card per option. Real (visually hidden) inputs carry the semantics:
 * radios for a single answer (arrow keys, Enter submits the step), checkboxes for several.
 */
export function ChoiceList<T extends string>({
  name,
  labelledBy,
  options,
  labels,
  value,
  onChange,
  multiple = false,
}: {
  name: string;
  labelledBy: string;
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
    <div
      role={multiple ? "group" : "radiogroup"}
      aria-labelledby={labelledBy}
      className="grid gap-3"
    >
      {options.map((option) => {
        const on = selected.has(option);
        return (
          <label
            key={option}
            className={cn(
              "flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-2xl border-[1.5px] px-5 py-3 text-left text-base font-semibold text-ink transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
              on ? "border-ink bg-powder-light" : "border-line bg-white",
            )}
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={option}
              aria-label={labels[option]}
              checked={on}
              onChange={() => toggle(option)}
              className="sr-only"
            />
            {labels[option]}
            <span
              aria-hidden
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                on ? "bg-ink text-white" : "border-[1.5px] border-line",
              )}
            >
              {on && <Check className="h-4 w-4" strokeWidth={3} />}
            </span>
          </label>
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
  className,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <Card className={cn("space-y-2 p-5", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="font-display text-4xl tabular-nums leading-none">
          {value}
          <span className="ml-1 text-base font-semibold text-ink-soft">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={(e) => {
          // Enter advances like in a text field; not every browser submits from a range input.
          if (e.key !== "Enter") return;
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }}
        className="block h-11 w-full cursor-pointer rounded-full accent-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        aria-label={label}
      />
    </Card>
  );
}

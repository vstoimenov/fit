"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { portionLabel, stepGrams } from "@/lib/nutrition/estimate-draft";
import { formatNumber } from "@/lib/nutrition/format";
import type { EstimateItem } from "@/lib/nutrition/schema";

const roundButton =
  "flex size-11 shrink-0 items-center justify-center rounded-full bg-sand active:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40";

/**
 * The AI breakdown, one row per food: the name, the amount with − / + in half portions of the
 * estimated serving (the grams stay visible and editable), the portion it makes and ≈ kcal. Macros
 * live in the total below the rows, not in every row. `rows` are the numbers shown; `texts` is what
 * she typed, which can be ahead of `rows` while the typed amount is not valid (`problems` says why).
 */
export function EstimateRows({
  rows,
  base,
  texts,
  problems,
  disabled,
  onGrams,
  onRemove,
  unit = "г",
}: {
  /** „мл“ for drinks (stored as grams, 1 g per ml). */
  unit?: "г" | "мл";
  rows: EstimateItem[];
  /** The rows as estimated: one portion each. */
  base: EstimateItem[];
  texts: string[];
  /** Per row: why the typed amount cannot be used, or null. */
  problems: (string | null)[];
  disabled: boolean;
  onGrams: (index: number, text: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((row, index) => {
        const problem = problems[index] ?? null;
        const baseGrams = base[index]?.grams ?? row.grams;
        const step = (direction: 1 | -1) =>
          onGrams(index, String(stepGrams(baseGrams, row.grams, direction)));
        return (
          // Rows only ever shrink and never reorder, so the index is a stable key within one breakdown.
          <li key={index} className="space-y-2 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 break-words pt-3 text-sm font-semibold">{row.name}</p>
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`Махни: ${row.name}`}
                className={cn(roundButton, "bg-transparent")}
              >
                <Trash2 size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={disabled}
                aria-label={`По-малко: ${row.name}`}
                className={roundButton}
              >
                <Minus size={20} strokeWidth={2.25} aria-hidden="true" />
              </button>
              <input
                value={texts[index] ?? ""}
                onChange={(event) => onGrams(index, event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                disabled={disabled}
                aria-label={`Количество (${unit}): ${row.name}`}
                aria-invalid={problem !== null}
                aria-describedby={problem ? `grams-problem-${index}` : undefined}
                className={cn(inputClass, "h-11 w-20 px-2 text-center", problem && "border-brick")}
              />
              <span className="text-sm text-ink-soft">{unit}</span>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={disabled}
                aria-label={`Повече: ${row.name}`}
                className={roundButton}
              >
                <Plus size={20} strokeWidth={2.25} aria-hidden="true" />
              </button>
              <span className="ml-auto text-sm font-extrabold tabular-nums">
                ≈ {formatNumber(row.kcal)} ккал
              </span>
            </div>
            <p className="text-xs text-ink-soft">
              {problem ? null : portionLabel(baseGrams, row.grams)}
            </p>
            {problem && (
              <p id={`grams-problem-${index}`} role="alert" className="text-xs text-brick">
                {problem}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

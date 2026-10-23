"use client";

import { Trash2 } from "lucide-react";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/nutrition/format";
import type { EstimateItem } from "@/lib/nutrition/schema";

/**
 * The AI breakdown, one row per food: name, an amount she can change (kcal and macros follow at once),
 * ≈ kcal, protein/carbs/fat and a remove button. The numbers shown are `rows`; `texts` is what she typed,
 * which can be ahead of `rows` while the typed amount is not valid (`problems` says why).
 */
export function EstimateRows({
  rows,
  texts,
  problems,
  disabled,
  onGrams,
  onRemove,
}: {
  rows: EstimateItem[];
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
        return (
          // Rows only ever shrink and never reorder, so the index is a stable key within one breakdown.
          <li key={index} className="space-y-1 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 break-words pt-3 text-sm font-semibold">{row.name}</p>
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`Махни: ${row.name}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-full active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
              >
                <Trash2 size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={texts[index] ?? ""}
                onChange={(event) => onGrams(index, event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                disabled={disabled}
                aria-label={`Количество в грамове: ${row.name}`}
                aria-invalid={problem !== null}
                aria-describedby={problem ? `grams-problem-${index}` : undefined}
                className={cn(inputClass, "h-11 w-24 px-3 text-sm", problem && "border-brick")}
              />
              <span className="text-sm text-ink-soft">г</span>
              <span className="ml-auto text-sm font-semibold">≈ {formatNumber(row.kcal)} ккал</span>
            </div>
            <p className="text-xs text-ink-soft">
              Белтъчини {formatNumber(row.proteinG)} г · въглехидрати {formatNumber(row.carbsG)} г ·
              мазнини {formatNumber(row.fatG)} г
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

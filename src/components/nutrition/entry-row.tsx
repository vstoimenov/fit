"use client";

import { Check, Trash2, X } from "lucide-react";
import { useState } from "react";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/nutrition/format";
import type { FoodEntry } from "@/server/nutrition/diary";

const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-full active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Accepts „150“ and „150,5“; anything else is not an amount. */
function parseGrams(raw: string): number | null {
  const value = Number(raw.trim().replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(value) ? value : null;
}

/**
 * One logged food: name, amount (tap to change; kcal and macros scale with it) and ≈ kcal. Without
 * `onGrams`/`onDelete` (a lapsed member) the row is read-only.
 */
export function EntryRow({
  entry,
  onGrams,
  onDelete,
}: {
  entry: FoodEntry;
  onGrams?: (id: string, grams: number) => void;
  onDelete?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const canEditGrams = entry.grams !== null && onGrams !== undefined;

  function open() {
    setDraft(String(entry.grams ?? ""));
    setInvalid(false);
    setEditing(true);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const grams = parseGrams(draft);
    if (grams === null || grams < 1 || grams > 2000) {
      setInvalid(true);
      return;
    }
    setEditing(false);
    if (grams !== entry.grams) onGrams?.(entry.id, grams);
  }

  return (
    <li className="flex min-h-11 items-center gap-2 py-1">
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold">{entry.name}</p>
        {editing ? (
          <form onSubmit={save} className="mt-1 flex items-center gap-2" noValidate>
            <input
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setInvalid(false);
              }}
              onKeyDown={(event) => event.key === "Escape" && setEditing(false)}
              inputMode="decimal"
              autoFocus
              aria-label={`Количество в грамове: ${entry.name}`}
              aria-invalid={invalid}
              className={cn(inputClass, "h-11 w-24 px-3 text-sm", invalid && "border-brick")}
            />
            <span className="text-sm text-ink-soft">г</span>
            <button type="submit" aria-label="Запази количеството" className={iconButton}>
              <Check size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Откажи"
              onClick={() => setEditing(false)}
              className={iconButton}
            >
              <X size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>
        ) : (
          <p className="text-xs text-ink-soft">
            {entry.grams !== null &&
              (canEditGrams ? (
                <button
                  type="button"
                  onClick={open}
                  aria-label={`Промени количеството: ${entry.name}`}
                  className="-my-3 inline-flex min-h-11 items-center font-semibold text-ink underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {formatNumber(entry.grams)} г
                </button>
              ) : (
                <span>{formatNumber(entry.grams)} г</span>
              ))}
            {entry.grams !== null && " · "}≈ {formatNumber(entry.kcal)} ккал
          </p>
        )}
        {invalid && (
          <p role="alert" className="text-xs text-brick">
            Количеството е между 1 и 2000 г.
          </p>
        )}
      </div>
      {onDelete && !editing && (
        <button
          type="button"
          onClick={() => onDelete(entry.id)}
          aria-label={`Изтрий: ${entry.name}`}
          className={iconButton}
        >
          <Trash2 size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

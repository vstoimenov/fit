"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { deleteEntryAction, updateEntry } from "@/app/app/nutrition/actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  DAY_RESULT_LABEL,
  DAY_RESULT_STYLE,
  dayResult,
  rescale,
  sumEntries,
} from "@/lib/nutrition/day";
import { formatGrams, formatNumber } from "@/lib/nutrition/format";
import { MEAL_SLOTS, type MealSlot } from "@/lib/nutrition/labels";
import type { Target } from "@/lib/nutrition/target";
import type { FoodEntry, FoodItem } from "@/server/nutrition/diary";
import { AddFoodSheet } from "./add-food-sheet";
import { CalorieRing } from "./calorie-ring";
import { EntryRow } from "./entry-row";
import { MealGroup } from "./meal-group";

type Change = { type: "delete"; id: string } | { type: "grams"; id: string; grams: number };

/** What the list looks like while a change is still on its way to the server. */
function applyChange(entries: FoodEntry[], change: Change): FoodEntry[] {
  if (change.type === "delete") return entries.filter((e) => e.id !== change.id);
  return entries.map((e) => {
    if (e.id !== change.id || e.grams === null) return e;
    const scaled = rescale(
      {
        name: e.name,
        grams: e.grams,
        kcal: e.kcal,
        proteinG: e.proteinG,
        carbsG: e.carbsG,
        fatG: e.fatG,
      },
      change.grams,
    );
    // Out of bounds: leave it as is, the server answers with the reason.
    return scaled
      ? {
          ...e,
          grams: scaled.grams,
          kcal: scaled.kcal,
          proteinG: scaled.proteinG,
          carbsG: scaled.carbsG,
          fatG: scaled.fatG,
        }
      : e;
  });
}

/**
 * The day: ring, result, four meal groups. Totals follow edits and deletes right away (optimistic) and
 * settle on the server's numbers when the request returns. Remounted per day (`key`), so a half-typed
 * form never leaks into another day.
 */
export function DiaryView({
  day,
  entries,
  target,
  canWrite,
  showResult,
  aiEnabled,
  recent,
}: {
  day: string;
  entries: FoodEntry[];
  target: Target | null;
  canWrite: boolean;
  /** Past day, or today after 20:00 Sofia. */
  showResult: boolean;
  /** The describe-in-words estimate is available (an API key is set on the server). */
  aiEnabled: boolean;
  /** Her latest distinct foods, for one-tap adding. */
  recent: FoodItem[];
}) {
  const [shown, change] = useOptimistic(entries, applyChange);
  const [openMeal, setOpenMeal] = useState<MealSlot | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function run(op: Change, call: () => ReturnType<typeof updateEntry>) {
    setMessage(null);
    startTransition(async () => {
      change(op);
      try {
        const result = await call();
        if (!result.ok) setMessage(result.message);
      } catch {
        setMessage("Нещо се обърка. Опитай отново.");
      }
    });
  }

  const totals = sumEntries(shown);
  const result =
    showResult && target && shown.length > 0 ? dayResult(totals.kcal, target.kcal) : null;

  return (
    <div className="space-y-6">
      <section aria-label="Калории за деня" className="space-y-4 rounded-2xl p-5 ring-1 ring-line">
        <CalorieRing
          total={totals.kcal}
          target={target?.kcal ?? null}
          macros={totals}
          macroTargets={target}
        />
        <p className="text-center text-xs text-ink-soft">Ориентир, не медицински съвет.</p>
        {!target && (
          <p className="rounded-2xl bg-sand px-4 py-3 text-center text-sm">
            Добави ръст, тегло и година на раждане, за да изчислим целта ти
            <Link
              href="/app/profile"
              className="mt-1 flex min-h-11 items-center justify-center font-semibold underline underline-offset-4"
            >
              Отвори Профил
            </Link>
          </p>
        )}
      </section>

      {result && (
        <section
          aria-label="Резултат за деня"
          className={cn("space-y-1 rounded-2xl p-4", DAY_RESULT_STYLE[result])}
        >
          <p className="font-extrabold">{DAY_RESULT_LABEL[result]}</p>
          <p className="text-sm">
            {formatNumber(totals.kcal)} ккал · белтъчини {formatGrams(totals.proteinG)} ·
            въглехидрати {formatGrams(totals.carbsG)} · мазнини {formatGrams(totals.fatG)}
          </p>
        </section>
      )}

      {!canWrite && (
        <section className="space-y-3 rounded-2xl bg-sand p-5">
          <p className="font-semibold">Записването е достъпно с активен абонамент.</p>
          <Link href="/app/plan" className={`${buttonClass("primary", "md")} w-full`}>
            Виж плановете
          </Link>
        </section>
      )}

      {message && (
        <p role="alert" className="text-sm text-brick">
          {message}
        </p>
      )}

      <div className="space-y-3">
        {MEAL_SLOTS.map((meal) => {
          const rows = shown.filter((e) => e.meal === meal);
          // A lapsed member sees only what she logged; an empty group would just be noise.
          if (!canWrite && rows.length === 0) return null;
          return (
            <MealGroup
              key={meal}
              meal={meal}
              kcal={rows.reduce((sum, e) => sum + e.kcal, 0)}
              count={rows.length}
              onAdd={canWrite ? () => setOpenMeal(meal) : undefined}
              addOpen={openMeal === meal}
              addPanel={
                <AddFoodSheet
                  day={day}
                  meal={meal}
                  aiEnabled={aiEnabled}
                  recent={recent}
                  onClose={() => setOpenMeal(null)}
                />
              }
            >
              {rows.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  onGrams={
                    canWrite
                      ? (id, grams) =>
                          run({ type: "grams", id, grams }, () => updateEntry({ id, grams }))
                      : undefined
                  }
                  onDelete={
                    canWrite
                      ? (id) => run({ type: "delete", id }, () => deleteEntryAction({ id }))
                      : undefined
                  }
                />
              ))}
            </MealGroup>
          );
        })}
        {!canWrite && shown.length === 0 && (
          <p className="text-ink-soft">Няма записи за този ден.</p>
        )}
      </div>
    </div>
  );
}

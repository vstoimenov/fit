import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/nutrition/format";
import { MEAL_LABEL, type MealSlot } from "@/lib/nutrition/labels";

/**
 * One meal of the day: title, its kcal, the entries (as children) and „+ Добави“. Which meal's add
 * panel is open is decided by the diary (one at a time); `addPanel` is what opens there, so the manual
 * form can be replaced by the full add sheet without touching this component.
 */
export function MealGroup({
  meal,
  kcal,
  count,
  onAdd,
  addOpen,
  addPanel,
  children,
}: {
  meal: MealSlot;
  kcal: number;
  count: number;
  /** Undefined = read-only: no add button. */
  onAdd?: () => void;
  addOpen: boolean;
  addPanel: ReactNode;
  children: ReactNode;
}) {
  const headingId = `meal-${meal}`;
  return (
    <section aria-labelledby={headingId} className="space-y-1 rounded-2xl p-4 ring-1 ring-line">
      <header className="flex min-h-11 items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="font-extrabold">
            {MEAL_LABEL[meal]}
          </h3>
          {count > 0 && <p className="text-xs text-ink-soft">≈ {formatNumber(kcal)} ккал</p>}
        </div>
        {onAdd && !addOpen && (
          <Button variant="secondary" size="md" onClick={onAdd}>
            + Добави<span className="sr-only"> към {MEAL_LABEL[meal].toLowerCase()}</span>
          </Button>
        )}
      </header>
      {count > 0 && <ul className="divide-y divide-line">{children}</ul>}
      {addOpen && addPanel}
    </section>
  );
}

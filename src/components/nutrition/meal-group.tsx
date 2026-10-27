"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import { formatNumber } from "@/lib/nutrition/format";
import { DIARY_LABEL, type DiarySlot } from "@/lib/nutrition/labels";

/**
 * One meal of the day: title, its kcal, the entries (as children) and „+ Добави“. Which meal's add
 * panel is open is decided by the diary (one at a time); `addPanel` is what opens there (the add
 * sheet, a modal). The button stays in place behind the sheet and takes focus back when it closes.
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
  meal: DiarySlot;
  kcal: number;
  count: number;
  /** Undefined = read-only: no add button. */
  onAdd?: () => void;
  addOpen: boolean;
  addPanel: ReactNode;
  children: ReactNode;
}) {
  const headingId = `meal-${meal}`;
  const addButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Closing the sheet puts focus back on the button that opened it (not every browser does this itself,
  // e.g. Safari does not focus a button on tap).
  useEffect(() => {
    if (wasOpen.current && !addOpen) addButton.current?.focus();
    wasOpen.current = addOpen;
  }, [addOpen]);

  return (
    <section aria-labelledby={headingId} className="space-y-1 rounded-2xl p-4 ring-1 ring-line">
      <header className="flex min-h-11 items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="font-extrabold">
            {DIARY_LABEL[meal]}
          </h3>
          {count > 0 && <p className="text-xs text-ink-soft">≈ {formatNumber(kcal)} ккал</p>}
        </div>
        {onAdd && (
          <button
            ref={addButton}
            type="button"
            onClick={onAdd}
            className={buttonClass("secondary", "md")}
          >
            + Добави<span className="sr-only"> към {DIARY_LABEL[meal].toLowerCase()}</span>
          </button>
        )}
      </header>
      {count > 0 && <ul className="divide-y divide-line">{children}</ul>}
      {addOpen && addPanel}
    </section>
  );
}

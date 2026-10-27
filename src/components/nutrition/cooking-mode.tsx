"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { amountLabel, stepIngredients, type RecipeIngredient } from "@/lib/nutrition/recipe";

const navButton =
  "flex size-12 shrink-0 items-center justify-center rounded-full text-white active:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:invisible";

/**
 * Full-screen cooking view: one step at a time with the ingredients that step uses (for the portions
 * she chose), arrows and swipes to move, and a „Готово“ screen after the last step. The screen stays
 * awake while it is open (where the browser allows it).
 */
export function CookingMode({
  steps,
  ingredients,
  portions,
  servings,
  onClose,
}: {
  steps: string[];
  ingredients: RecipeIngredient[];
  portions: number;
  servings: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const done = index >= steps.length;

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      void lock?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(steps.length, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, onClose]);

  const step = steps[index] ?? "";
  const used = done ? [] : stepIngredients(step, ingredients);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Готвене стъпка по стъпка"
      className="fixed inset-0 z-50 flex flex-col bg-rose-deep pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-white"
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start === null || end === undefined || Math.abs(end - start) < 60) return;
        setIndex((i) => (end < start ? Math.min(steps.length, i + 1) : Math.max(0, i - 1)));
      }}
    >
      <header className="flex items-center justify-between px-5 pt-4">
        <p className="text-lg font-semibold">Стъпки</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Затвори готвенето"
          className={navButton}
        >
          <X size={28} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </header>

      <div className="flex items-center justify-between px-3 pt-6">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          aria-label="Предишна стъпка"
          className={navButton}
        >
          <ChevronLeft size={32} strokeWidth={2.25} aria-hidden="true" />
        </button>
        <p aria-live="polite" className="font-display font-extrabold">
          {done ? (
            <span className="text-4xl">Готово</span>
          ) : (
            <>
              <span className="text-6xl tabular-nums">{index + 1}</span>
              <span className="text-2xl text-white/60"> / {steps.length}</span>
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(steps.length, i + 1))}
          disabled={done}
          aria-label={index === steps.length - 1 ? "Готово" : "Следваща стъпка"}
          className={navButton}
        >
          <ChevronRight size={32} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-8">
        {done ? (
          <div className="space-y-6 text-center">
            <p className="text-2xl font-semibold">Приятен апетит!</p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 font-semibold text-rose-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Към рецептата
            </button>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-line text-2xl leading-snug">{step}</p>
            {used.length > 0 && (
              <section className="mt-auto space-y-2 pb-6 pt-10">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-white/80">
                  Съставки
                </h2>
                <p className="text-lg">
                  {used
                    .map((i) => {
                      const item = ingredients[i]!;
                      return `${amountLabel(item, portions, servings)} ${item.name.toLowerCase()}`;
                    })
                    .join(", ")}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

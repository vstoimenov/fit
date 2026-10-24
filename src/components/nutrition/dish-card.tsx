"use client";

import { Check, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { eatMenuItem, swapMenuSlot } from "@/app/app/nutrition/actions";
import { ArticleCover } from "@/components/learn/article-card";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { formatGrams, formatNumber } from "@/lib/nutrition/format";

/** Everything a dish card shows, already scaled to her portion (the full meal never goes to the client). */
export type DishCardData = {
  slot: number;
  label: string;
  mealId: string;
  title: string;
  photoUrl: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** „порция ×1,2“, null for a standard portion. */
  portion: string | null;
  canSwap: boolean;
  eaten: boolean;
  /** The one primary button of the screen. */
  primary: boolean;
};

type Busy = "swap" | "eat";

/**
 * One slot of today's menu. „Смени“ and „Изядох го“ are guarded by a ref (a double tap sends one
 * request) and disabled while either runs. The batch id lives as long as the page view, so a retry
 * after a failed „Изядох го“ cannot log the dish twice.
 */
export function DishCard({ day, dish }: { day: string; dish: DishCardData }) {
  const guard = useRef(false);
  const batchId = useRef<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logged, setLogged] = useState(false);
  const eaten = dish.eaten || logged;

  async function run(kind: Busy, call: () => ReturnType<typeof swapMenuSlot>) {
    if (guard.current) return;
    guard.current = true;
    setBusy(kind);
    setError(null);
    try {
      const result = await call();
      if (!result.ok) setError(result.message);
      else if (kind === "eat") setLogged(true);
    } catch {
      setError("Нещо се обърка. Опитай отново.");
    } finally {
      guard.current = false;
      setBusy(null);
    }
  }

  const headingId = `dish-${dish.slot}`;

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-2xl ring-1 ring-line">
      {dish.photoUrl ? (
        <ArticleCover
          src={dish.photoUrl}
          sizes="(min-width:1024px) 480px, 100vw"
          className="aspect-[16/9]"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex aspect-[16/9] items-center justify-center bg-sand text-ink-soft"
        >
          <UtensilsCrossed size={32} strokeWidth={1.75} />
        </div>
      )}
      <div className="space-y-3 p-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-ink-soft">{dish.label}</p>
          <h3 id={headingId} className="break-words text-lg font-extrabold leading-snug">
            {dish.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">≈ {formatNumber(dish.kcal)} ккал</p>
            {dish.portion && <Chip>{dish.portion}</Chip>}
          </div>
          <p className="text-xs text-ink-soft">
            белтъчини {formatGrams(dish.proteinG)} · въглехидрати {formatGrams(dish.carbsG)} ·
            мазнини {formatGrams(dish.fatG)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/nutrition/recipe/${dish.mealId}?slot=${dish.slot}`}
            className={buttonClass("link", "md")}
          >
            Рецепта<span className="sr-only">: {dish.title}</span>
          </Link>
          {dish.canSwap && !eaten && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("swap", () => swapMenuSlot({ day, slot: dish.slot }))}
              className={buttonClass("secondary", "md")}
            >
              Смени<span className="sr-only">: {dish.label.toLowerCase()}</span>
            </button>
          )}
          {eaten ? (
            <Chip className="min-h-11 px-4 text-sm">
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
              Записано в дневника
            </Chip>
          ) : (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                batchId.current ??= crypto.randomUUID();
                const id = batchId.current;
                void run("eat", () => eatMenuItem({ day, slot: dish.slot, batchId: id }));
              }}
              className={buttonClass(dish.primary ? "primary" : "secondary", "md")}
            >
              Изядох го<span className="sr-only">: {dish.label.toLowerCase()}</span>
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-brick">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

"use client";

import { ChevronLeft, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ArticleCover } from "@/components/learn/article-card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { formatGrams, formatNumber } from "@/lib/nutrition/format";
import { ALLERGEN_LABEL } from "@/lib/nutrition/labels";
import type { Meal } from "@/lib/nutrition/meal-schema";
import { amountLabel, parseSteps, totalMinutes } from "@/lib/nutrition/recipe";
import { CookingMode } from "./cooking-mode";

type Tab = "ingredients" | "nutrition" | "diet";
const TABS: { id: Tab; label: string }[] = [
  { id: "ingredients", label: "Съставки" },
  { id: "nutrition", label: "Калории" },
  { id: "diet", label: "Диета" },
];

const roundButton =
  "flex size-11 items-center justify-center rounded-full bg-powder-chip text-rose-deep active:bg-powder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40";

/**
 * A recipe the way a cook reads it on the phone: photo, title, time and diet at a glance, the
 * ingredients for the portions she picks, numbered steps and „Започни да готвиш“, which opens the
 * step-by-step cooking view.
 */
export function RecipeView({
  meal,
  backHref,
  menuPortion,
  allergyNote,
}: {
  meal: Meal;
  backHref: string;
  /** Her portion from today's menu, when she came from a menu card. */
  menuPortion: { kcal: number; label: string } | null;
  allergyNote: string;
}) {
  const servings = meal.servings || 1;
  const [portions, setPortions] = useState(servings);
  const [tab, setTab] = useState<Tab>("ingredients");
  const [cooking, setCooking] = useState(false);
  const steps = parseSteps(meal.steps);
  const total = totalMinutes(meal.prepMin, meal.cookMin);
  const diets = [
    meal.fitsVegan && "Веган",
    !meal.fitsVegan && meal.fitsVegetarian && "Вегетарианско",
    !meal.fitsVegan && !meal.fitsVegetarian && meal.fitsPescatarian && "Пескатарианско",
    !meal.allergens.includes("gluten") && "Без глутен",
    !meal.fitsVegan && !meal.allergens.includes("milk") && "Без мляко",
  ].filter((d): d is string => Boolean(d));
  const longest = Math.max(meal.prepMin ?? 0, meal.cookMin ?? 0, 1);

  return (
    <main className="mx-auto max-w-2xl pb-44 lg:mx-0 lg:pb-16">
      <div className="relative">
        {meal.photoUrl ? (
          <ArticleCover
            src={meal.photoUrl}
            sizes="(min-width:1024px) 672px, 100vw"
            className="aspect-[4/5] sm:aspect-[16/10] lg:mt-6 lg:rounded-2xl"
            preload
          />
        ) : (
          <div className="aspect-[16/9] bg-powder-chip lg:mt-6 lg:rounded-2xl" aria-hidden="true" />
        )}
        <Link
          href={backHref}
          aria-label="Назад"
          className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full bg-white/95 text-rose-deep shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ChevronLeft size={24} strokeWidth={2.25} aria-hidden="true" />
        </Link>
      </div>

      <div className="space-y-7 px-5 pt-6 lg:px-0">
        <header className="space-y-4">
          <h1 className="font-display text-3xl font-extrabold leading-tight">{meal.title}</h1>
          <ul className="flex flex-wrap gap-2">
            {total !== null && (
              <li>
                <Chip tone="powder">{total} мин</Chip>
              </li>
            )}
            {diets.map((d) => (
              <li key={d}>
                <Chip>{d}</Chip>
              </li>
            ))}
          </ul>
          {total !== null && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Подготовка", value: meal.prepMin, bar: "bg-moss", text: "text-moss" },
                { label: "Готвене", value: meal.cookMin, bar: "bg-powder", text: "text-rose-deep" },
              ].map((t) => (
                <div key={t.label} className="space-y-1.5">
                  <p className={cn("text-xs font-extrabold uppercase tracking-wide", t.text)}>
                    {t.label}
                  </p>
                  <div className="h-1.5 rounded-full bg-line">
                    <div
                      className={cn("h-full rounded-full", t.bar)}
                      style={{ width: `${Math.round(((t.value ?? 0) / longest) * 100)}%` }}
                    />
                  </div>
                  <p className="text-sm">{t.value === null ? "—" : `${t.value} мин`}</p>
                </div>
              ))}
            </div>
          )}
        </header>

        {meal.description && (
          <p className="whitespace-pre-line leading-relaxed text-ink">{meal.description}</p>
        )}

        <section aria-label="Информация" className="space-y-4">
          <div
            role="tablist"
            aria-label="Информация за рецептата"
            className="flex gap-5 overflow-x-auto"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={cn(
                  "min-h-11 shrink-0 border-b-[3px] text-sm font-extrabold uppercase tracking-wide focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  tab === t.id
                    ? "border-rose-deep text-rose-deep"
                    : "border-transparent text-ink-soft",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "ingredients" && (
              <div className="space-y-5">
                <ul className="space-y-3">
                  {meal.ingredients.map((ingredient, i) => (
                    <li key={i} className="flex items-baseline gap-3">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-2.5 shrink-0 rounded-full bg-powder"
                      />
                      <span>
                        <strong className="font-extrabold">
                          {amountLabel(ingredient, portions, servings)}
                        </strong>{" "}
                        {ingredient.name.toLowerCase()}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between rounded-2xl bg-sand px-4 py-2">
                  <p className="text-sm font-extrabold uppercase tracking-wide text-rose-deep">
                    Порции
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPortions((p) => Math.max(1, p - 1))}
                      disabled={portions <= 1}
                      aria-label="По-малко порции"
                      className={roundButton}
                    >
                      <Minus size={20} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    <span
                      aria-live="polite"
                      className="w-8 text-center text-lg font-extrabold tabular-nums"
                    >
                      {portions}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPortions((p) => Math.min(48, p + 1))}
                      aria-label="Повече порции"
                      className={roundButton}
                    >
                      <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "nutrition" && (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">
                  За една порция{servings > 1 ? ` (рецептата е за ${servings})` : ""}:
                </p>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Калории", `${formatNumber(meal.kcal)} ккал`],
                    ["Белтъчини", formatGrams(meal.proteinG)],
                    ["Въглехидрати", formatGrams(meal.carbsG)],
                    ["Мазнини", formatGrams(meal.fatG)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-sand p-3">
                      <dt className="text-xs font-semibold text-ink-soft">{label}</dt>
                      <dd className="text-lg font-extrabold">{value}</dd>
                    </div>
                  ))}
                </dl>
                {menuPortion && (
                  <p className="text-sm">
                    Твоята порция от менюто: ≈ {formatNumber(menuPortion.kcal)} ккал
                    {menuPortion.label && (
                      <span className="text-ink-soft"> · {menuPortion.label}</span>
                    )}
                  </p>
                )}
              </div>
            )}

            {tab === "diet" && (
              <div className="space-y-4">
                {diets.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {diets.map((d) => (
                      <li key={d}>
                        <Chip>{d}</Chip>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Съдържа</p>
                  {meal.allergens.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {meal.allergens.map((a) => (
                        <li key={a}>
                          <Chip tone="powder">{ALLERGEN_LABEL[a]}</Chip>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-soft">Няма отбелязани алергени.</p>
                  )}
                </div>
                <p className="text-xs text-ink-soft">{allergyNote}</p>
              </div>
            )}
          </div>
        </section>

        {steps.length > 0 && (
          <section aria-labelledby="steps" className="space-y-5">
            <h2 id="steps" className="text-2xl font-extrabold tracking-tight">
              Стъпки
            </h2>
            <ol className="space-y-6">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="w-10 shrink-0 font-display text-4xl font-extrabold leading-none text-rose-deep"
                  >
                    {i + 1}
                  </span>
                  <p className="whitespace-pre-line pt-1 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {steps.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-5 lg:static lg:mt-10 lg:px-0">
          <button
            type="button"
            onClick={() => setCooking(true)}
            className="mx-auto flex min-h-14 w-full max-w-2xl items-center justify-center rounded-2xl bg-rose-deep text-base font-extrabold uppercase tracking-wide text-white shadow-lg active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Започни да готвиш
          </button>
        </div>
      )}

      {cooking && (
        <CookingMode
          steps={steps}
          ingredients={meal.ingredients}
          portions={portions}
          servings={servings}
          onClose={() => setCooking(false)}
        />
      )}
    </main>
  );
}

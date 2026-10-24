import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleBody } from "@/components/learn/article-body";
import { ArticleCover } from "@/components/learn/article-card";
import { ALLERGY_NOTE } from "@/components/nutrition/menu-view";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { formatGrams, formatNumber } from "@/lib/nutrition/format";
import { ALLERGEN_LABEL } from "@/lib/nutrition/labels";
import { formatPortion, scalePortion } from "@/lib/nutrition/menu";
import { sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import { getMenuDay } from "@/server/nutrition/menu";
import { getPublishedMeal } from "@/server/nutrition/meals";

export const metadata = { title: "Рецепта" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ slot?: string }>;

export default function RecipePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Recipe params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const backLinkClass =
  "inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

async function Recipe({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const [{ id }, { slot: rawSlot }] = await Promise.all([params, searchParams]);
  const { user, supabase } = await requireUser();

  // A malformed id would be a database error, not a missing row.
  if (!UUID.test(id)) notFound();

  const { data: hasAccess, error } = await supabase.rpc("my_access");
  if (error) throw new Error(`check access failed: ${error.message}`);
  if (hasAccess !== true) {
    return (
      <main className="mx-auto max-w-2xl space-y-5 px-5 pb-10 pt-6 lg:mx-0 lg:px-8">
        <Link href="/app/nutrition?view=menu" className={backLinkClass}>
          ← Меню
        </Link>
        <section className="space-y-3 rounded-2xl bg-sand p-5">
          <p className="font-semibold">Рецептите са достъпни с активен абонамент.</p>
          <Link href="/app/plan" className={`${buttonClass("primary", "md")} w-full`}>
            Виж плановете
          </Link>
        </section>
      </main>
    );
  }

  // RLS shows members published meals only; this keeps an admin's draft out of this page too.
  const meal = await getPublishedMeal(supabase, id);
  if (!meal) notFound();

  // She arrives from a menu card: use that day's portion for the slot, but only if it is this dish.
  let factor = 1;
  const slot = /^[0-4]$/.test(rawSlot ?? "") ? Number(rawSlot) : null;
  if (slot !== null) {
    try {
      const menu = await getMenuDay(supabase, user.id, sofiaToday());
      const pick = menu.slots[slot]?.pick;
      if (pick && pick.meal.id === meal.id) factor = pick.factor;
    } catch (error) {
      // The recipe is still worth showing at the standard portion.
      console.error(
        "recipe page: menu portion unavailable",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const portion = scalePortion(meal, factor);
  const portionLabel = formatPortion(factor);

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 pb-10 pt-6 lg:mx-0 lg:px-8">
      <Link href="/app/nutrition?view=menu" className={backLinkClass}>
        ← Меню
      </Link>
      <header className="space-y-3">
        <h1 className="font-display text-3xl leading-tight">{meal.title}</h1>
        <p className="text-sm font-semibold">
          ≈ {formatNumber(portion.kcal)} ккал
          {portionLabel && <span className="font-normal text-ink-soft"> · {portionLabel}</span>}
        </p>
        <p className="text-sm text-ink-soft">
          белтъчини {formatGrams(portion.proteinG)} · въглехидрати {formatGrams(portion.carbsG)} ·
          мазнини {formatGrams(portion.fatG)}
        </p>
        {meal.allergens.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-ink-soft">Съдържа</p>
            <ul className="flex flex-wrap gap-2">
              {meal.allergens.map((allergen) => (
                <li key={allergen}>
                  <Chip tone="powder">{ALLERGEN_LABEL[allergen]}</Chip>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>
      {meal.photoUrl && (
        <ArticleCover
          src={meal.photoUrl}
          sizes="(min-width:1024px) 672px, 100vw"
          className="aspect-[16/9] rounded-2xl"
          preload
        />
      )}
      <section aria-labelledby="ingredients" className="space-y-2">
        <h2 id="ingredients" className="text-xl font-extrabold tracking-tight">
          Съставки
        </h2>
        <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
          {portion.ingredients.map((ingredient, index) => (
            <li
              key={index}
              className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm"
            >
              <span className="min-w-0 break-words">{ingredient.name}</span>
              <span className="shrink-0 font-semibold">{formatGrams(ingredient.grams)}</span>
            </li>
          ))}
        </ul>
      </section>
      {meal.steps.trim() !== "" && (
        <section aria-labelledby="steps" className="space-y-2">
          <h2 id="steps" className="text-xl font-extrabold tracking-tight">
            Приготвяне
          </h2>
          <ArticleBody body={meal.steps} />
        </section>
      )}
      <p className="text-xs text-ink-soft">{ALLERGY_NOTE}</p>
    </main>
  );
}

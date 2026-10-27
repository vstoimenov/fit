import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ALLERGY_NOTE } from "@/components/nutrition/menu-view";
import { RecipeView } from "@/components/nutrition/recipe-view";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { buttonClass } from "@/components/ui/button";
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
    <Suspense fallback={<PageSkeleton cards={2} />}>
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
    <RecipeView
      meal={meal}
      backHref={slot !== null ? "/app/nutrition?view=menu" : "/app/learn?vid=recipe"}
      menuPortion={slot !== null ? { kcal: portion.kcal, label: portionLabel ?? "" } : null}
      allergyNote={ALLERGY_NOTE}
    />
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/learn/article-card";
import { CommunityCard } from "@/components/learn/community-card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { RecordingCard } from "@/components/learn/recording-card";
import { RecipeCard } from "@/components/nutrition/recipe-card";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { requireUser } from "@/server/auth/require-user";
import { getCommunityLink, listArticlesFor, type ArticleCategory } from "@/server/content/articles";
import { getMemberLevel } from "@/server/content/member";
import { listRecordings } from "@/server/live/sessions";
import { listRecipeMeals } from "@/server/nutrition/meals";

export const metadata = { title: "Полезно" };

const VIEWS = {
  all: "Всичко",
  article: "Статии",
  recipe: "Рецепти",
  recording: "Записи на живо",
} as const;
type View = keyof typeof VIEWS;

type SearchParams = Promise<{ vid?: string | string[] }>;

export default function LearnPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Learn searchParams={searchParams} />
    </Suspense>
  );
}

async function Learn({ searchParams }: { searchParams: SearchParams }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const raw = (await searchParams).vid;
  const view: View = typeof raw === "string" && Object.hasOwn(VIEWS, raw) ? (raw as View) : "all";
  const { user, supabase } = await requireUser();
  const level = await getMemberLevel(supabase, user.id);
  const category: ArticleCategory | undefined =
    view === "article" || view === "recipe" ? view : undefined;
  const [articles, recordings, communityUrl, recipeMeals] = await Promise.all([
    view === "recording"
      ? Promise.resolve([])
      : listArticlesFor(supabase, level, undefined, category),
    view === "all" || view === "recording" ? listRecordings(supabase) : Promise.resolve([]),
    getCommunityLink(supabase),
    view === "all" || view === "recipe"
      ? listRecipeMeals(supabase).catch((error: unknown) => {
          // The articles still show if the dishes cannot be read.
          console.error(
            "learn: recipes unavailable",
            error instanceof Error ? error.message : String(error),
          );
          return [];
        })
      : Promise.resolve([]),
  ]);
  const recipes = articles.filter((a) => a.category === "recipe");
  const plain = articles.filter((a) => a.category !== "recipe");

  return (
    <main className="space-y-6 px-5 pb-6 pt-8 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Полезно</h1>
      <div
        role="group"
        aria-label="Вид съдържание"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {(Object.keys(VIEWS) as View[]).map((v) => (
          <Link
            key={v}
            href={v === "all" ? "/app/learn" : `/app/learn?vid=${v}`}
            aria-current={view === v ? "true" : undefined}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Chip tone={view === v ? "ink" : "neutral"} className="px-4 py-2 text-sm">
              {VIEWS[v]}
            </Chip>
          </Link>
        ))}
      </div>
      {view === "all" && <CommunityCard url={communityUrl} />}

      {(view === "recording" || (view === "all" && recordings.length > 0)) && (
        <section aria-labelledby="recordings-heading" className="space-y-4">
          <h2 id="recordings-heading" className="text-xl font-extrabold tracking-tight">
            Записи на живо
          </h2>
          {recordings.length === 0 ? (
            <Card className="p-5 text-ink-soft">Записите от сесиите на живо ще са тук.</Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recordings.map((s) => (
                <RecordingCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </section>
      )}

      {(view === "recipe" || (view === "all" && recipes.length + recipeMeals.length > 0)) && (
        <section aria-labelledby="recipes-heading" className="space-y-4">
          <h2 id="recipes-heading" className="text-xl font-extrabold tracking-tight">
            Рецепти
          </h2>
          {recipes.length + recipeMeals.length === 0 ? (
            <Card className="p-5 text-ink-soft">Скоро тук ще има рецепти от нас.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recipeMeals.map((m) => (
                <RecipeCard key={m.id} meal={m} />
              ))}
              {recipes.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}
        </section>
      )}

      {(view === "all" || view === "article") && (
        <section aria-labelledby="articles-heading" className="space-y-4">
          <h2 id="articles-heading" className="text-xl font-extrabold tracking-tight">
            Статии
          </h2>
          {plain.length === 0 ? (
            <Card className="p-5 text-ink-soft">Скоро тук ще има статии от нас.</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {plain.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

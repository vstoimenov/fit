import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCover } from "@/components/learn/article-card";
import { ArticleBody } from "@/components/learn/article-body";
import { Chip } from "@/components/ui/chip";
import { formatArticleDate } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/labels";
import { requireUser } from "@/server/auth/require-user";
import { getArticleBySlug } from "@/server/content/articles";

export const metadata = { title: "Полезно" };

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Article params={params} />
    </Suspense>
  );
}

async function Article({ params }: { params: Promise<{ slug: string }> }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { slug } = await params;
  const { supabase } = await requireUser();
  const article = await getArticleBySlug(supabase, slug);
  // RLS hides drafts and members-only articles she can't open: those are plain 404s.
  if (!article) notFound();

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-5 pb-10 pt-6 lg:mx-0 lg:px-8">
      <Link
        href="/app/learn"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        ← Полезно
      </Link>
      <header className="space-y-3">
        <h1 className="font-display text-3xl leading-tight">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {article.published_at && (
            <span className="text-sm font-semibold text-ink-soft">
              {formatArticleDate(new Date(article.published_at))}
            </span>
          )}
          {article.level && <Chip tone="powder">{LEVEL_LABEL[article.level]}</Chip>}
        </div>
      </header>
      {article.cover_url && (
        <ArticleCover
          src={article.cover_url}
          sizes="(min-width:1024px) 672px, 100vw"
          className="aspect-[16/9] rounded-2xl"
          preload
        />
      )}
      <ArticleBody body={article.body} />
    </main>
  );
}

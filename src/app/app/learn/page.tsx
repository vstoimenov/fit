import { connection } from "next/server";
import { Suspense } from "react";
import { ArticleCard } from "@/components/learn/article-card";
import { CommunityCard } from "@/components/learn/community-card";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/auth/require-user";
import { getCommunityLink, listArticlesFor } from "@/server/content/articles";
import { getMemberLevel } from "@/server/content/member";

export const metadata = { title: "Полезно" };

export default function LearnPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Learn />
    </Suspense>
  );
}

async function Learn() {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { user, supabase } = await requireUser();
  const level = await getMemberLevel(supabase, user.id);
  const [articles, communityUrl] = await Promise.all([
    listArticlesFor(supabase, level),
    getCommunityLink(supabase),
  ]);

  return (
    <main className="space-y-6 px-5 pb-6 pt-8 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Полезно</h1>
      <CommunityCard url={communityUrl} />
      <section aria-labelledby="articles-heading" className="space-y-4">
        <h2 id="articles-heading" className="text-xl font-extrabold tracking-tight">
          Статии
        </h2>
        {articles.length === 0 ? (
          <Card className="p-5 text-ink-soft">Скоро тук ще има статии от нас.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

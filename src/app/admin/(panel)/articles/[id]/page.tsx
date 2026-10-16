import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Chip } from "@/components/ui/chip";
import { getArticle } from "@/server/admin/articles";
import { requireAdmin } from "@/server/admin/require-admin";
import { updateArticleAction } from "../actions";
import { ArticleForm } from "../article-form";

export const metadata = { title: "Статия" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };

export default function EditArticlePage(props: Props) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <EditArticle {...props} />
    </Suspense>
  );
}

async function EditArticle({ params, searchParams }: Props) {
  await connection();
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const article = z.uuid().safeParse(id).success ? await getArticle(supabase, id) : null;
  if (!article) notFound();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">{article.title}</h1>
        <Chip tone={article.publishedAt ? "powder" : "neutral"}>
          {article.publishedAt ? "Публикувана" : "Чернова"}
        </Chip>
      </header>
      {saved && (
        <p role="status" className="text-moss">
          Създадена ✓
        </p>
      )}
      <ArticleForm action={updateArticleAction.bind(null, article.id)} article={article} />
    </div>
  );
}

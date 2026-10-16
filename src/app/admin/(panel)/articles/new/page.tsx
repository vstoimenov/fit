import { createArticleAction } from "../actions";
import { ArticleForm } from "../article-form";

export const metadata = { title: "Нова статия" };

export default function NewArticlePage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Нова статия</h1>
      <ArticleForm action={createArticleAction} />
    </div>
  );
}

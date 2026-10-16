import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { utcToZoned } from "@/lib/admin/time";
import { LEVEL_LABEL } from "@/lib/labels";
import { listArticles } from "@/server/admin/articles";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Статии" };

export default function ArticlesPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Articles />
    </Suspense>
  );
}

async function Articles() {
  await connection();
  const { supabase } = await requireAdmin();
  const articles = await listArticles(supabase);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Статии</h1>
        <Link href="/admin/articles/new" className={buttonClass("primary", "md")}>
          Нова статия
        </Link>
      </header>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="p-3">Заглавие</th>
              <th className="p-3">Ниво</th>
              <th className="p-3">Достъп</th>
              <th className="p-3">Статус</th>
              <th className="p-3">Публикувана</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className="p-3">
                  <Link
                    href={`/admin/articles/${a.id}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {a.title}
                  </Link>
                </td>
                <td className="p-3">{a.level ? LEVEL_LABEL[a.level] : "Всички нива"}</td>
                <td className="p-3">{a.membersOnly ? "Само с абонамент" : "За всички"}</td>
                <td className="p-3">
                  <Chip tone={a.publishedAt ? "powder" : "neutral"}>
                    {a.publishedAt ? "Публикувана" : "Чернова"}
                  </Chip>
                </td>
                <td className="p-3 tabular-nums">
                  {a.publishedAt ? utcToZoned(a.publishedAt).date : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {articles.length === 0 && <p className="p-4 text-ink-soft">Още няма статии.</p>}
      </div>
    </div>
  );
}

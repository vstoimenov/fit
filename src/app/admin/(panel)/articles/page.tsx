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

const KINDS = { all: "Всички", article: "Статии", recipe: "Рецепти" } as const;
type Kind = keyof typeof KINDS;
const KIND_LABEL = { article: "Статия", recipe: "Рецепта" } as const;

type Props = { searchParams: Promise<{ vid?: string | string[] }> };

export default function ArticlesPage(props: Props) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Articles {...props} />
    </Suspense>
  );
}

async function Articles({ searchParams }: Props) {
  await connection();
  const raw = (await searchParams).vid;
  const kind: Kind = typeof raw === "string" && Object.hasOwn(KINDS, raw) ? (raw as Kind) : "all";
  const { supabase } = await requireAdmin();
  const all = await listArticles(supabase);
  const articles = kind === "all" ? all : all.filter((a) => a.category === kind);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Статии</h1>
        <Link href="/admin/articles/new" className={buttonClass("primary", "md")}>
          Нова статия
        </Link>
      </header>
      <div role="group" aria-label="Вид" className="flex flex-wrap gap-2">
        {(Object.keys(KINDS) as Kind[]).map((k) => (
          <Link
            key={k}
            href={k === "all" ? "/admin/articles" : `/admin/articles?vid=${k}`}
            aria-current={kind === k ? "true" : undefined}
            className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Chip tone={kind === k ? "ink" : "neutral"} className="px-4 py-2 text-sm">
              {KINDS[k]}
            </Chip>
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="p-3">Заглавие</th>
              <th className="p-3">Вид</th>
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
                <td className="p-3">{KIND_LABEL[a.category]}</td>
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

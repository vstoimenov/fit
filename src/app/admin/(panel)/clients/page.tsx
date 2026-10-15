import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LevelBadge } from "@/components/admin/level-badge";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import { listClients } from "@/server/admin/clients";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Клиентки" };
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const PAGE = 50;
const MAX_PAGE = 10_000;
const date = (iso: string | null) => (iso ? utcToZoned(iso).date : "—");

export default function ClientsPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Clients searchParams={searchParams} />
    </Suspense>
  );
}

async function Clients({ searchParams }: { searchParams: Search }) {
  await connection();
  const sp = await searchParams;
  const q = (one(sp.q) ?? "").slice(0, 60);
  const page = Math.min(MAX_PAGE, Math.max(1, Math.floor(Number(one(sp.page))) || 1));
  const { supabase } = await requireAdmin();
  const link = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  const result = await listClients(supabase, {
    search: q,
    limit: PAGE,
    offset: (page - 1) * PAGE,
  });
  if (page > 1 && result.rows.length === 0) {
    // Past the end (a stale link, or rows were removed): the RPC reports no total for an empty page,
    // so ask for the first row to learn the real count, then send her to the last page that exists.
    const { total: all } = await listClients(supabase, { search: q, limit: 1 });
    const last = Math.max(1, Math.ceil(all / PAGE));
    if (last < page) redirect(link(last));
  }
  const { rows, total } = result;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">
        Клиентки <span className="text-ink-soft">({total})</span>
      </h1>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Име или имейл"
          aria-label="Търси по име или имейл"
          maxLength={60}
          className={inputClass + " max-w-xs"}
        />
        <button className={buttonClass("quiet", "md")}>Търси</button>
      </form>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="p-3">Име</th>
              <th className="p-3">Ниво</th>
              <th className="p-3">Абонамент</th>
              <th className="p-3">Регистрация</th>
              <th className="p-3">Последно влизане</th>
              <th className="p-3">Последна тренировка</th>
              <th className="p-3">Тренировки</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.userId} className="border-t border-line">
                <td className="p-3">
                  <Link
                    href={`/admin/clients/${c.userId}`}
                    className="font-semibold hover:underline"
                  >
                    {c.name || "—"}
                  </Link>
                  <p className="text-xs text-ink-soft">{c.email}</p>
                </td>
                <td className="p-3">
                  <LevelBadge level={c.level} />
                </td>
                <td className="p-3">
                  {c.hasAccess
                    ? c.subProvider === "manual"
                      ? "Ръчен"
                      : "Активен"
                    : c.subStatus === "past_due"
                      ? "Просрочен"
                      : "—"}
                </td>
                <td className="p-3 tabular-nums">{date(c.joinedAt)}</td>
                <td className="p-3 tabular-nums">{date(c.lastSeenAt)}</td>
                <td className="p-3 tabular-nums">{date(c.lastDoneAt)}</td>
                <td className="p-3 tabular-nums">{c.totalDone}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-ink-soft">Няма клиентки.</p>}
      </div>
      {pages > 1 && (
        <nav className="flex gap-2">
          {page > 1 && (
            <Link href={link(page - 1)} className={buttonClass("quiet", "md")}>
              ← Предишна
            </Link>
          )}
          <span className="self-center text-sm">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link href={link(page + 1)} className={buttonClass("quiet", "md")}>
              Следваща →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

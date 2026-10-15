import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LevelBadge } from "@/components/admin/level-badge";
import { completionPct } from "@/lib/admin/risk";
import { cn } from "@/lib/cn";
import { listAllClients, type ClientRow } from "@/server/admin/clients";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Активност" };

const SORTS = {
  done7: { label: "Тренировки 7д", key: (c: ClientRow) => c.done7 },
  done30: { label: "Тренировки 30д", key: (c: ClientRow) => c.done30 },
  minutes7: { label: "Минути 7д", key: (c: ClientRow) => c.minutes7 },
  minutes30: { label: "Минути 30д", key: (c: ClientRow) => c.minutes30 },
  pct: {
    label: "% за 14д",
    key: (c: ClientRow) => completionPct(c.doneRegular14, c.published14) ?? -1,
  },
} as const;
type SortKey = keyof typeof SORTS;
type Search = Promise<{ sort?: string | string[] }>;

export default function ActivityPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}

async function Activity({ searchParams }: { searchParams: Search }) {
  await connection();
  const { sort: raw } = await searchParams;
  const sort: SortKey =
    typeof raw === "string" && Object.hasOwn(SORTS, raw) ? (raw as SortKey) : "done7";
  const { supabase } = await requireAdmin();
  const rows = await listAllClients(supabase);
  const subscribers = rows
    .filter((c) => c.hasAccess)
    .sort((a, b) => SORTS[sort].key(b) - SORTS[sort].key(a));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Активност</h1>
      <p className="text-sm text-ink-soft">
        Само клиентки с достъп. Серията се вижда в профила на всяка клиентка.
      </p>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="p-3">Клиентка</th>
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <th key={k} className="p-3" aria-sort={k === sort ? "descending" : undefined}>
                  <Link
                    href={`?sort=${k}`}
                    className={cn("hover:underline", k === sort && "font-bold text-ink")}
                  >
                    {SORTS[k].label}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subscribers.map((c) => {
              const pct = completionPct(c.doneRegular14, c.published14);
              return (
                <tr key={c.userId} className="border-t border-line">
                  <td className="p-3">
                    <Link
                      href={`/admin/clients/${c.userId}`}
                      className="font-semibold hover:underline"
                    >
                      {c.name || c.email}
                    </Link>{" "}
                    <LevelBadge level={c.level} />
                  </td>
                  <td className="p-3 tabular-nums">{c.done7}</td>
                  <td className="p-3 tabular-nums">{c.done30}</td>
                  <td className="p-3 tabular-nums">{c.minutes7}</td>
                  <td className="p-3 tabular-nums">{c.minutes30}</td>
                  <td className="p-3 tabular-nums">
                    {pct === null ? "—" : `${pct}% (${c.doneRegular14}/${c.published14})`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {subscribers.length === 0 && (
          <p className="p-4 text-ink-soft">Още няма клиентки с достъп.</p>
        )}
      </div>
    </div>
  );
}

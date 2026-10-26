import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import { listLeads } from "@/server/admin/leads";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Лийдове" };

type Search = Promise<{ q?: string | string[] }>;

export default function LeadsPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Leads searchParams={searchParams} />
    </Suspense>
  );
}

async function Leads({ searchParams }: { searchParams: Search }) {
  await connection();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const { supabase } = await requireAdmin();
  const leads = await listLeads(supabase, query || null);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Лийдове</h1>
        <a href="/admin/leads/export" className={buttonClass("secondary", "md")} download>
          Експорт CSV
        </a>
      </div>
      <form className="flex max-w-md gap-2" role="search">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Търси по имейл"
          className={inputClass}
          aria-label="Търси по имейл"
        />
        <button type="submit" className={buttonClass("primary", "md")}>
          Търси
        </button>
      </form>
      <p className="text-sm text-ink-soft">
        {leads.length} {leads.length === 1 ? "запис" : "записа"}
        {query ? ` за „${query}“` : ""} · от формата за безплатната тренировка
      </p>
      {leads.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-sm text-ink-soft ring-1 ring-line">
          Още няма лийдове.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
          <table className="w-full text-left text-sm">
            <thead className="text-xs tracking-wide text-ink-soft uppercase">
              <tr>
                <th className="px-3 py-2">Име</th>
                <th className="px-3 py-2">Имейл</th>
                <th className="px-3 py-2">Източник</th>
                <th className="px-3 py-2">Съвети по имейл</th>
                <th className="px-3 py-2">Дата</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const at = utcToZoned(l.created_at);
                return (
                  <tr key={l.id} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold">{l.name}</td>
                    <td className="px-3 py-2 break-all">{l.email}</td>
                    <td className="px-3 py-2 text-ink-soft">{l.source}</td>
                    <td className="px-3 py-2">{l.marketing_consent_at ? "да" : "не"}</td>
                    <td className="px-3 py-2 text-ink-soft tabular-nums">
                      {at.date} {at.time}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

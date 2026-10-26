import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { serverEnv } from "@/env";
import { stepRate } from "@/lib/admin/funnel";
import { formatPrice } from "@/lib/format";
import { getDashboard } from "@/server/admin/dashboard";
import { countRecentLeads } from "@/server/admin/leads";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Табло" };

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-4 ring-1 ring-line">
      <p className="break-words text-sm text-ink-soft">{label}</p>
      <p className="break-words font-display text-2xl font-extrabold tabular-nums sm:text-3xl">
        {value}
      </p>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await connection();
  const { supabase } = await requireAdmin();
  const now = new Date();
  const [d, leads7] = await Promise.all([
    getDashboard(supabase, now, new URL(serverEnv.APP_URL).host),
    countRecentLeads(supabase, now),
  ]);
  const { active, canceled_30 } = d.subscriptions;
  const churn =
    active + canceled_30 > 0 ? Math.round((canceled_30 / (active + canceled_30)) * 100) : 0;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-extrabold">Табло</h1>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Посещения днес" value={d.visits.today} />
        <Tile label="Посещения 7 дни" value={d.visits.d7} />
        <Tile
          label="Посещения 30 дни"
          value={d.visits.d30}
          hint={`${d.visits.unique_d30} уникални`}
        />
        <Tile
          label="Регистрации 7 / 30 дни"
          value={`${d.registrations.d7} / ${d.registrations.d30}`}
        />
        <Tile label="Лийдове 7 дни" value={leads7} hint="безплатна тренировка" />
        <Tile label="Активни абонаменти" value={active} />
        <Tile label="MRR" value={formatPrice(d.subscriptions.mrr_cents, "EUR")} />
        <Tile label="Откази 30 дни" value={canceled_30} hint={`churn ≈ ${churn}%`} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Фуния (30 дни)</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <Tile label="Посетители" value={d.funnel.visitors} />
          <Tile
            label="Регистрации"
            value={d.funnel.signups}
            hint={stepRate(d.funnel.visitors, d.funnel.signups)}
          />
          <Tile
            label="Безплатна тренировка"
            value={d.funnel.free_done}
            hint={stepRate(d.funnel.signups, d.funnel.free_done)}
          />
          <Tile
            label="Платили"
            value={d.funnel.paid}
            hint={stepRate(d.funnel.free_done, d.funnel.paid)}
          />
        </div>
        <p className="text-xs text-ink-soft">
          Регистрациите могат да надвишат проследените посетители (блокери на реклами, директни
          регистрации).
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-semibold">Източници (30 дни, посетители)</h2>
          <ul className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
            {d.sources.map((s) => (
              <li
                key={s.source}
                className="flex justify-between gap-3 border-b border-line py-1 last:border-0"
              >
                <span className="min-w-0 break-words">{s.source}</span>
                <span className="tabular-nums">{s.visitors}</span>
              </li>
            ))}
            {d.sources.length === 0 && <li className="text-ink-soft">Още няма посещения.</li>}
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold">Най-гледани (30 дни)</h2>
          <ul className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
            {d.top_workouts.map((w) => (
              <li
                key={w.id}
                className="flex justify-between gap-3 border-b border-line py-1 last:border-0"
              >
                <Link
                  href={`/admin/workouts/${w.id}`}
                  className="min-w-0 break-words hover:underline"
                >
                  {w.title}
                </Link>
                <span className="tabular-nums">{w.completions}</span>
              </li>
            ))}
            {d.top_workouts.length === 0 && (
              <li className="text-ink-soft">Още няма завършени тренировки.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

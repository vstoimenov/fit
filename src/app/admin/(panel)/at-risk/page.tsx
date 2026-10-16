import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LevelBadge } from "@/components/admin/level-badge";
import { completionPct, RISK_LABEL } from "@/lib/admin/risk";
import { utcToZoned } from "@/lib/admin/time";
import { requireAdmin } from "@/server/admin/require-admin";
import { listAtRisk } from "@/server/admin/risk";
import { getSettings } from "@/server/admin/settings";
import { RiskActions } from "./risk-actions";

export const metadata = { title: "Изостават" };

export default function AtRiskPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <AtRisk />
    </Suspense>
  );
}

async function AtRisk() {
  await connection();
  const { supabase } = await requireAdmin();
  const settings = await getSettings(supabase);
  const list = await listAtRisk(supabase, settings.risk);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold">
          Изостават <span className="text-ink-soft">({list.length})</span>
        </h1>
        <p className="text-sm text-ink-soft">
          Без тренировка ≥ {settings.risk.inactiveDays} дни · под {settings.risk.minCompletionPct}%
          за 14 дни · платила без тренировка · неуспешно плащане.{" "}
          <Link href="/admin/settings" className="underline">
            Промени праговете
          </Link>
        </p>
      </header>
      <ul className="space-y-3">
        {list.map(({ client: c, reasons }) => {
          const pct = completionPct(c.doneRegular14, c.published14);
          return (
            <li key={c.userId} className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/clients/${c.userId}`} className="font-semibold hover:underline">
                  {c.name || c.email}
                </Link>
                <LevelBadge level={c.level} />
                {reasons.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-brick/10 px-2 py-0.5 text-xs font-semibold text-brick"
                  >
                    {RISK_LABEL[r]}
                  </span>
                ))}
              </div>
              <p className="text-sm text-ink-soft">
                Последна тренировка: {c.lastDoneAt ? utcToZoned(c.lastDoneAt).date : "никога"} · 14
                дни: {c.doneRegular14}/{c.published14}
                {pct !== null ? ` (${pct}%)` : ""}
              </p>
              <RiskActions userId={c.userId} phone={c.phoneCallConsent ? c.phone : null} />
            </li>
          );
        })}
      </ul>
      {list.length === 0 && <p className="text-ink-soft">Всички тренират. 🎉</p>}
    </div>
  );
}

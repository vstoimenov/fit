import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Chip } from "@/components/ui/chip";
import { utcToZoned } from "@/lib/admin/time";
import { REWARDS } from "@/lib/points/levels";
import { requireAdmin } from "@/server/admin/require-admin";
import { listRewardCandidates, type RewardCandidate } from "@/server/admin/rewards";
import { setRewardGivenAction } from "./actions";

export const metadata = { title: "Награди" };

export default function RewardsPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Rewards />
    </Suspense>
  );
}

async function Rewards() {
  await connection();
  const { supabase } = await requireAdmin();
  const rows = await listRewardCandidates(supabase);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold">Награди</h1>
        <p className="text-sm text-ink-soft">
          Клиентки, стигнали ниво 4 или повече. Отбелязвай наградите, които си дала.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-ink-soft ring-1 ring-line">
          Още никой не е стигнал ниво 4.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-ink-soft">
              <tr>
                <th className="p-3">Клиентка</th>
                <th className="p-3">Ниво</th>
                <th className="p-3">Точки</th>
                <th className="p-3">Награди</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Row key={r.userId} row={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ row }: { row: RewardCandidate }) {
  return (
    <tr className="border-t border-line align-top">
      <td className="p-3">
        <Link
          href={`/admin/clients/${row.userId}`}
          className="font-semibold underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
        {row.name !== row.email && <p className="break-all text-ink-soft">{row.email}</p>}
      </td>
      <td className="p-3 tabular-nums">{row.level}</td>
      <td className="p-3 tabular-nums">{row.points}</td>
      <td className="p-3">
        <ul className="space-y-3">
          {row.reached.map((r) => (
            <li
              key={r.level}
              className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr_auto]"
            >
              <Chip tone={r.given ? "powder" : "neutral"}>Ниво {r.level}</Chip>
              <p>
                {REWARDS[r.level]}
                {r.given && r.givenAt && (
                  <span className="text-ink-soft"> · дадено {utcToZoned(r.givenAt).date}</span>
                )}
                {r.level === 10 && (
                  <Link
                    href={`/admin/clients/${row.userId}`}
                    className="ml-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
                  >
                    Дай 6 месеца
                  </Link>
                )}
              </p>
              <div className="col-span-2 flex flex-wrap items-center gap-x-4 sm:col-span-1">
                <ActionForm
                  key={`${r.level}-${r.given}`}
                  action={setRewardGivenAction.bind(null, row.userId, r.level, !r.given)}
                  submitLabel={r.given ? "Не е дадено" : "Дадено"}
                  submitAriaLabel={`${r.given ? "Не е дадено" : "Дадено"}: ${row.name}, ниво ${r.level}`}
                  confirmMessage={
                    r.given ? `Да махна отметката „Дадено“ за ниво ${r.level}?` : undefined
                  }
                  submitVariant="secondary"
                  successMessage="Готово ✓"
                  className="inline-flex items-center"
                >
                  <span />
                </ActionForm>
              </div>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { challengeStatus, dayDate, formatChallengeDate } from "@/lib/challenges/calendar";
import { sofiaToday } from "@/lib/progress-photos/today";
import { listChallenges } from "@/server/admin/challenges";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Предизвикателства" };

type Props = { searchParams: Promise<{ status?: string }> };

const STATUSES = ["published", "draft"] as const;
const STATUS_LABEL = { published: "Публикувани", draft: "Чернови" } as const;
const PHASE_LABEL = { upcoming: "Предстои", running: "Върви", ended: "Приключило" } as const;

export default function ChallengesPage(props: Props) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Challenges {...props} />
    </Suspense>
  );
}

async function Challenges({ searchParams }: Props) {
  await connection();
  const raw = (await searchParams).status;
  const status = STATUSES.find((s) => s === raw);
  const { supabase } = await requireAdmin();
  const all = await listChallenges(supabase);
  const today = sofiaToday();
  const shown = all.filter((c) => !status || c.published === (status === "published"));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Предизвикателства</h1>
        <Link href="/admin/challenges/new" className={buttonClass("primary", "md")}>
          Ново предизвикателство
        </Link>
      </header>

      <div role="group" aria-label="Статус" className="flex flex-wrap items-center gap-2">
        {[
          { value: "", label: "Всички" },
          ...STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
        ].map((option) => {
          const active = (status ?? "") === option.value;
          return (
            <Link
              key={option.value}
              href={option.value ? `/admin/challenges?status=${option.value}` : "/admin/challenges"}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold",
                active ? "bg-ink text-white" : "bg-sand text-ink",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th scope="col" className="p-3">
                Предизвикателство
              </th>
              <th scope="col" className="p-3">
                Период
              </th>
              <th scope="col" className="p-3">
                Участнички
              </th>
              <th scope="col" className="p-3">
                Статус
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="p-3">
                  <Link
                    href={`/admin/challenges/${c.id}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {c.title}
                  </Link>
                </td>
                <td className="p-3">
                  {formatChallengeDate(c.startDate)} –{" "}
                  {formatChallengeDate(dayDate(c.startDate, c.days))}
                  <span className="text-ink-soft"> · {c.days} дни</span>
                </td>
                <td className="p-3 tabular-nums">{c.participants}</td>
                <td className="flex flex-wrap gap-1 p-3">
                  <Chip tone={c.published ? "powder" : "neutral"}>
                    {c.published ? "Публикувано" : "Чернова"}
                  </Chip>
                  <Chip>{PHASE_LABEL[challengeStatus(c.startDate, c.days, today).status]}</Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="p-4 text-ink-soft">
            {all.length === 0
              ? "Още няма предизвикателства."
              : "Няма предизвикателства с този филтър."}
          </p>
        )}
      </div>
    </div>
  );
}

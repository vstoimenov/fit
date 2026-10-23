import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { DAY_RESULT_LABEL, DAY_RESULT_STYLE, dayResult, showDayResult } from "@/lib/nutrition/day";
import { formatNumber } from "@/lib/nutrition/format";
import { dayHref, historyDayLabel } from "@/lib/nutrition/history-format";
import { sofiaHour, sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import { getNutritionProfile, historyDays } from "@/server/nutrition/diary";
import { HistoryChart } from "@/components/nutrition/history-chart";

export const metadata = { title: "Последните 30 дни" };

export default function NutritionHistoryPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <History />
    </Suspense>
  );
}

async function History() {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { user, supabase } = await requireUser();
  const today = sofiaToday();
  const hour = sofiaHour();
  const [profile, days] = await Promise.all([
    getNutritionProfile(supabase, user.id),
    historyDays(supabase, user.id, today, 30),
  ]);
  const target = profile.target?.kcal ?? null;
  const newestFirst = [...days].reverse();
  const logged = days.filter((d) => d.count > 0);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-5 pb-10 pt-6 lg:mx-0 lg:px-8">
      <Link
        href="/app/nutrition"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        ← Хранене
      </Link>
      <header className="space-y-1">
        <h1 className="font-display text-3xl">Последните 30 дни</h1>
        <p className="text-sm text-ink-soft">Докосни ден, за да го отвориш.</p>
      </header>

      {logged.length === 0 ? (
        <p className="rounded-2xl bg-sand px-4 py-3 text-sm">
          Още няма записи. Добави първото си хранене от дневника.
        </p>
      ) : (
        <section aria-label="Графика" className="rounded-2xl p-4 ring-1 ring-line">
          <HistoryChart days={days} target={target} today={today} hour={hour} />
        </section>
      )}

      {target === null && (
        <p className="rounded-2xl bg-sand px-4 py-3 text-sm">
          Добави ръст, тегло и година на раждане, за да изчислим целта ти
          <Link
            href="/app/profile"
            className="mt-1 flex min-h-11 items-center font-semibold underline underline-offset-4"
          >
            Отвори Профил
          </Link>
        </p>
      )}

      <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
        {newestFirst.map((d) => {
          const result =
            target !== null && d.count > 0 && showDayResult(d.day, today, hour)
              ? dayResult(d.kcal, target)
              : null;
          return (
            <li key={d.day}>
              <Link
                href={dayHref(d.day, today)}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
              >
                <span className="font-semibold">{historyDayLabel(d.day)}</span>
                <span className="flex items-center gap-2 text-sm">
                  {result && (
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        DAY_RESULT_STYLE[result],
                      )}
                    >
                      {DAY_RESULT_LABEL[result]}
                    </span>
                  )}
                  {d.count === 0 ? (
                    <span className="text-ink-soft">няма записи</span>
                  ) : (
                    <span>{formatNumber(d.kcal)} ккал</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

import { Clock } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Countdown } from "@/components/today/countdown";
import { WeekStrip } from "@/components/today/week-strip";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StatTile } from "@/components/ui/stat-tile";
import { WorkoutCover } from "@/components/workout/workout-cover";
import { formatTodayDate } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/labels";
import { requireUser } from "@/server/auth/require-user";
import { getTodayView } from "@/server/content/today";

export const metadata = { title: "Днес" };

export default function TodayPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Today />
    </Suspense>
  );
}

const WEEK_GOAL = 5;

function daysText(n: number): string {
  return n === 1 ? "1 ден" : `${n} дни`;
}

async function Today() {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { user, supabase } = await requireUser();
  const view = await getTodayView(supabase, user.id);
  const firstName = view.name.split(" ")[0];
  const doneThisWeek = Math.min(WEEK_GOAL, view.week.filter((d) => d.done).length);

  return (
    <main className="px-5 pb-6 pt-8 lg:px-8">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-semibold text-ink-soft">
          {firstName ? `Здравей, ${firstName}` : "Здравей"} · {formatTodayDate(new Date())}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">Днес</h1>
      </header>

      <div className="space-y-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-8 lg:space-y-0">
        <section aria-label="Днешната тренировка" className="space-y-4 lg:col-span-3">
          {view.workout ? (
            <div className="overflow-hidden rounded-2xl bg-sand">
              <Link href={`/app/workout/${view.workout.id}`} className="block active:opacity-95">
                <div className="relative">
                  <WorkoutCover
                    focus={view.workout.focus[0] ?? null}
                    title={view.workout.title}
                    className="h-72 lg:h-96"
                    preload
                  />
                  <div className="absolute left-3 top-3 flex gap-2">
                    <Chip tone="powder">{LEVEL_LABEL[view.workout.level ?? view.level]}</Chip>
                    <Chip tone="neutral">{view.workout.durationMin} мин</Chip>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-sm font-semibold text-ink-soft">
                    {view.pick.kind === "free" && "Безплатна първа тренировка"}
                    {view.pick.kind === "starter" &&
                      `Стартова седмица · ${view.pick.index} от ${view.pick.total}`}
                    {view.pick.kind === "regular" && "Днешната тренировка"}
                  </p>
                  <span className={`${buttonClass("primary", "lg")} w-full`}>Започни</span>
                </div>
              </Link>
            </div>
          ) : view.pick.kind === "locked" ? (
            <div className="space-y-4 rounded-2xl bg-sand p-6">
              <p className="text-2xl font-extrabold tracking-tight">
                Готова си за следващата крачка
              </p>
              <p className="text-ink-soft">
                Отключи стартовата седмица и всички тренировки за твоето ниво.
              </p>
              <Link href="/app/plan" className={`${buttonClass("primary", "lg")} w-full`}>
                Виж плана си
              </Link>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl bg-sand p-6">
              <p className="text-2xl font-extrabold tracking-tight">Днес е за почивка</p>
              <p className="text-ink-soft">
                Направила си всичко публикувано. Повтори любима тренировка от{" "}
                <Link href="/app/library" className="underline underline-offset-4">
                  библиотеката
                </Link>
                .
              </p>
            </div>
          )}

          {view.nextDropAt && (
            <div className="flex items-center gap-3 rounded-2xl bg-sand px-4 py-3 text-sm">
              <Clock size={20} strokeWidth={2} aria-hidden="true" className="shrink-0" />
              <p>
                Нова тренировка след{" "}
                <strong className="font-bold">
                  <Countdown to={view.nextDropAt} />
                </strong>
              </p>
            </div>
          )}
        </section>

        <div className="space-y-6 lg:col-span-2">
          <WeekStrip week={view.week} />

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Тази седмица"
              value={`${doneThisWeek}/${WEEK_GOAL}`}
              progress={doneThisWeek / WEEK_GOAL}
            />
            <StatTile label="Поредица" value={daysText(view.streak)} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6">
            <Link href="/app/check-in" className={buttonClass("link")}>
              Отбележи прогрес
            </Link>
            <Link href="/app/library" className={buttonClass("link")}>
              Библиотека
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

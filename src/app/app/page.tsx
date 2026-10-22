import { ChartLine, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LevelCard } from "@/components/home/level-card";
import { ArticleCard } from "@/components/learn/article-card";
import { Countdown } from "@/components/today/countdown";
import { WeekStrip } from "@/components/today/week-strip";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StatTile } from "@/components/ui/stat-tile";
import { WorkoutCover } from "@/components/workout/workout-cover";
import { formatTodayDate } from "@/lib/format";
import { seriesParts } from "@/lib/program/completion-stats";
import { LEVEL_LABEL } from "@/lib/labels";
import { levelProgress } from "@/lib/points/levels";
import { requireUser } from "@/server/auth/require-user";
import { listArticlesFor, type ArticleSummary } from "@/server/content/articles";
import { getMemberPoints } from "@/server/content/points";
import { getTodayView } from "@/server/content/today";

export const metadata = { title: "Начало" };

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { user, supabase } = await requireUser();
  const view = await getTodayView(supabase, user.id);
  // Level and article are extras: if their reads fail the day's workout must still show.
  const [progress, article] = await Promise.all([
    getMemberPoints(supabase, user.id).then(
      (p) => levelProgress(p.points),
      (error: unknown) => logSkipped("points", user.id, error, null),
    ),
    listArticlesFor(supabase, view.level).then(
      (list): ArticleSummary | null => list[0] ?? null,
      (error: unknown) => logSkipped("article", user.id, error, null),
    ),
  ]);
  const firstName = view.name.split(" ")[0];

  return (
    <main className="px-5 pb-6 pt-8 lg:px-8">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-semibold text-ink-soft">
          {formatTodayDate(new Date(), view.timezone)}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {firstName ? `Здравей, ${firstName}` : "Здравей"}
        </h1>
      </header>

      <div className="space-y-6 lg:grid lg:grid-cols-5 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8 lg:gap-y-6 lg:space-y-0">
        {progress && (
          <div className="lg:col-span-2 lg:col-start-4 lg:row-start-1">
            <LevelCard progress={progress} />
          </div>
        )}

        <div className="space-y-6 lg:col-span-3 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <section aria-label="Днешната тренировка" className="space-y-4">
            {view.workout ? (
              <div className="overflow-hidden rounded-2xl bg-sand">
                <Link href={`/app/workout/${view.workout.id}`} className="block active:opacity-95">
                  <div className="relative">
                    <WorkoutCover
                      focus={view.workout.focus[0] ?? null}
                      title={view.workout.title}
                      className="h-44 sm:h-52 lg:h-60"
                      decorative
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
                  <strong className="font-extrabold">
                    <Countdown to={view.nextDropAt} />
                  </strong>
                </p>
              </div>
            )}
          </section>

          <WeekStrip week={view.week} />

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Тази седмица"
              value={`${view.weekDone}/${view.weekTarget}`}
              progress={view.weekDone / view.weekTarget}
              note={view.weekDone >= view.weekTarget ? "Целта е изпълнена" : undefined}
            />
            <StatTile label="Серия" {...seriesParts(view.streak)} />
          </div>
        </div>

        <div className="space-y-6 lg:col-span-2 lg:col-start-4 lg:row-start-2">
          <Link
            href="/app/progress"
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-sand p-4 active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ChartLine size={24} strokeWidth={2} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-extrabold">Прогрес</span>
              <span className="block text-sm text-ink-soft">
                Отбележи седмицата и виж как вървиш
              </span>
            </span>
            <ChevronRight size={20} strokeWidth={2} aria-hidden="true" className="shrink-0" />
          </Link>

          {article && (
            <section aria-labelledby="home-article-heading" className="space-y-3">
              <h2 id="home-article-heading" className="text-xl font-extrabold tracking-tight">
                Полезно за теб
              </h2>
              <ArticleCard article={article} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function logSkipped<T>(what: string, userId: string, error: unknown, fallback: T): T {
  console.error(`home ${what} skipped`, { userId }, error instanceof Error ? error.message : error);
  return fallback;
}

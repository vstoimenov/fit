import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Countdown } from "@/components/today/countdown";
import { WeekStrip } from "@/components/today/week-strip";
import { buttonClass } from "@/components/ui/button";
import { WorkoutCover } from "@/components/workout/workout-cover";
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

async function Today() {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { user, supabase } = await requireUser();
  const view = await getTodayView(supabase, user.id);
  const firstName = view.name.split(" ")[0] || "здравей";

  return (
    <main className="space-y-8 px-5 pt-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-soft">{LEVEL_LABEL[view.level]}</p>
          <h1 className="font-display text-3xl font-bold">Здравей, {firstName}</h1>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-black leading-none">{view.streak}</p>
          <p className="text-xs font-semibold text-ink-soft">поредни</p>
        </div>
      </header>

      <WeekStrip week={view.week} />

      {view.workout ? (
        <Link
          href={`/app/workout/${view.workout.id}`}
          className="block overflow-hidden rounded-[2rem] bg-ink text-paper active:scale-[0.99]"
        >
          <WorkoutCover
            level={view.workout.level}
            kind={view.workout.kind}
            title={view.workout.title}
            className="h-44"
          />
          <div className="space-y-3 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-paper/60">
              {view.pick.kind === "free" && "Безплатна първа тренировка"}
              {view.pick.kind === "starter" &&
                `Стартова седмица · ${view.pick.index} от ${view.pick.total}`}
              {view.pick.kind === "regular" && "Днешната тренировка"}
            </p>
            <p className="font-display text-2xl font-bold leading-tight">{view.workout.title}</p>
            <p className="text-paper/70">{view.workout.durationMin} минути</p>
            <span className={buttonClass("primary", "md")}>Започни</span>
          </div>
        </Link>
      ) : view.pick.kind === "locked" ? (
        <section className="space-y-4 rounded-[2rem] bg-white p-6 ring-1 ring-line">
          <p className="font-display text-2xl font-bold">Готова си за следващата крачка</p>
          <p className="text-ink-soft">
            Отключи стартовата седмица и всички тренировки за твоето ниво.
          </p>
          <Link href="/app/plan" className={buttonClass("primary", "md")}>
            Виж плана си
          </Link>
        </section>
      ) : (
        <section className="space-y-2 rounded-[2rem] bg-white p-6 ring-1 ring-line">
          <p className="font-display text-2xl font-bold">Днес е за почивка</p>
          <p className="text-ink-soft">
            Направила си всичко публикувано. Повтори любима тренировка от{" "}
            <Link href="/app/library" className="underline">
              библиотеката
            </Link>
            .
          </p>
        </section>
      )}

      {view.nextDropAt && (
        <p className="rounded-2xl bg-ink/5 px-5 py-4 text-sm">
          Нова тренировка след{" "}
          <strong>
            <Countdown to={view.nextDropAt} />
          </strong>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/check-in" className={buttonClass("ghost", "md")}>
          Отбележи прогрес
        </Link>
        <Link href="/app/library" className={buttonClass("quiet", "md")}>
          Библиотека
        </Link>
      </div>
    </main>
  );
}

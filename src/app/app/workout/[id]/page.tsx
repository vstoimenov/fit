import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { Player } from "@/components/workout/player";
import { WorkoutCover } from "@/components/workout/workout-cover";
import { requireUser } from "@/server/auth/require-user";
import { getWorkoutForPlayer } from "@/server/content/workouts";

export const metadata = { title: "Тренировка" };

export default function WorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ first?: string }>;
}) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-ink" aria-busy="true" />}>
      <WorkoutScreen params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkoutScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ first?: string }>;
}) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const [{ id }, { first }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireUser();
  const result = await getWorkoutForPlayer(supabase, id);
  if (!result) notFound();

  if (result.state === "broken") {
    return (
      <main className="space-y-4 px-5 pt-8">
        <Link href="/app" className="text-sm font-semibold text-ink-soft">
          ← Назад
        </Link>
        <h1 className="font-display text-2xl font-bold">{result.workout.title}</h1>
        <p className="text-ink-soft">
          Видеото се обновява. Опитай пак след малко или избери друга тренировка.
        </p>
        <Link href="/app/library" className={buttonClass("quiet", "md")}>
          Към библиотеката
        </Link>
      </main>
    );
  }

  if (result.state === "locked") {
    return (
      <main className="space-y-6 px-5 pt-8">
        <Link href="/app" className="text-sm font-semibold text-ink-soft">
          ← Назад
        </Link>
        <WorkoutCover
          level={result.workout.level}
          kind={result.workout.kind}
          title={result.workout.title}
          className="h-48 rounded-[2rem]"
        />
        <h1 className="font-display text-2xl font-bold">{result.workout.title}</h1>
        <p className="text-ink-soft">Тази тренировка се отключва с абонамента.</p>
        <Link href="/app/plan" className={buttonClass("primary", "lg") + " w-full"}>
          Отключи всички тренировки
        </Link>
      </main>
    );
  }

  return (
    <Player
      workout={result.workout}
      embedUrl={result.embedUrl}
      first={first === "1"}
      unlockAfterSec={Math.round(result.workout.durationMin * 60 * 0.7)}
    />
  );
}

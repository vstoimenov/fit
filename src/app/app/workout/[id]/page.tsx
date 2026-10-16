import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Player } from "@/components/workout/player";
import { WorkoutCover } from "@/components/workout/workout-cover";
import { LEVEL_LABEL } from "@/lib/labels";
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
    <Suspense fallback={<main className="min-h-dvh" aria-busy="true" />}>
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
  const { user, supabase } = await requireUser();
  const result = await getWorkoutForPlayer(supabase, id);
  if (!result) notFound();

  if (result.state === "broken") {
    return (
      <main className="space-y-5 px-5 pb-6 pt-4 lg:px-8">
        <BackLink />
        <h1 className="text-2xl font-extrabold tracking-tight">{result.workout.title}</h1>
        <p className="text-ink-soft">
          Видеото се обновява. Опитай пак след малко или избери друга тренировка.
        </p>
        <Link href="/app/library" className={buttonClass("secondary", "md")}>
          Към тренировките
        </Link>
      </main>
    );
  }

  if (result.state === "locked") {
    const { workout } = result;
    return (
      <main className="pb-6 lg:px-8 lg:pt-6">
        <BackLink />
        <div className="lg:grid lg:grid-cols-5 lg:items-start lg:gap-8">
          <WorkoutCover
            focus={workout.focus[0] ?? null}
            title={workout.title}
            showTitle={false}
            preload
            className="aspect-video w-full lg:col-span-3 lg:rounded-2xl"
          />
          <section className="space-y-5 px-5 pt-5 lg:col-span-2 lg:px-0 lg:pt-0">
            <div className="space-y-3">
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
                {workout.title}
              </h1>
              <div className="flex flex-wrap gap-2">
                {workout.level && <Chip tone="powder">{LEVEL_LABEL[workout.level]}</Chip>}
                <Chip>{workout.durationMin} мин</Chip>
              </div>
              <p className="text-ink-soft">Тази тренировка се отключва с абонамента.</p>
            </div>
            <Link href="/app/plan" className={`${buttonClass("primary", "lg")} w-full`}>
              Отключи всички тренировки
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <Player
      workout={result.workout}
      embedUrl={result.embedUrl}
      first={first === "1"}
      unlockAfterSec={Math.round(result.workout.durationMin * 60 * 0.7)}
      name={profile?.name.split(" ")[0] || null}
    />
  );
}

function BackLink() {
  return (
    <Link
      href="/app"
      className="inline-flex min-h-11 items-center gap-1.5 px-5 text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:mb-2 lg:px-0"
    >
      <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
      Назад
    </Link>
  );
}

import { connection } from "next/server";
import { Suspense } from "react";
import { serverEnv } from "@/env";
import { DayNav } from "@/components/nutrition/day-nav";
import { DiaryView } from "@/components/nutrition/diary-view";
import { NutritionAnswersForm } from "@/components/nutrition/nutrition-answers-form";
import { showDayResult } from "@/lib/nutrition/day";
import { parseDayParam } from "@/lib/nutrition/day-param";
import { sofiaHour, sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import { getDiaryDay, getNutritionProfile, recentFoods } from "@/server/nutrition/diary";

export const metadata = { title: "Хранене" };

// The AI estimate (a server action invoked from this page) can take ~20 s; Server Actions inherit the
// page's limit.
export const maxDuration = 30;

type SearchParams = Promise<{ day?: string }>;

export default function NutritionPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Nutrition searchParams={searchParams} />
    </Suspense>
  );
}

async function Nutrition({ searchParams }: { searchParams: SearchParams }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { day: rawDay } = await searchParams;
  const { user, supabase } = await requireUser();
  const today = sofiaToday();
  const day = parseDayParam(rawDay, today);
  const [profile, diary, recent] = await Promise.all([
    getNutritionProfile(supabase, user.id),
    getDiaryDay(supabase, user.id, day),
    recentFoods(supabase, user.id, 10),
  ]);

  // First visit: the questions come before the diary. Without access she cannot answer here (the plan
  // card below the read-only diary says why), so only members with access see the form.
  if (profile.hasAccess && profile.answers === null) {
    return (
      <main className="space-y-6 px-5 pt-8 lg:px-8">
        <header className="space-y-2">
          <h1 className="font-display text-3xl">Хранене</h1>
          <p className="text-ink-soft">Няколко въпроса, за да изчислим целта ти.</p>
        </header>
        <NutritionAnswersForm initial={null} submitLabel="Продължи" />
      </main>
    );
  }

  return (
    <main className="space-y-6 px-5 pt-8 lg:px-8">
      <h1 className="font-display text-3xl">Хранене</h1>
      <DayNav day={day} today={today}>
        <DiaryView
          key={day}
          day={day}
          entries={diary.entries}
          target={profile.target}
          canWrite={profile.hasAccess}
          showResult={showDayResult(day, today, sofiaHour())}
          aiEnabled={Boolean(serverEnv.ANTHROPIC_API_KEY)}
          recent={profile.hasAccess ? recent : []}
        />
      </DayNav>
    </main>
  );
}

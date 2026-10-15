import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { serverEnv } from "@/env";
import { LEVEL_LABEL, type Goal, type Time } from "@/lib/labels";
import { buildPlanSummary } from "@/lib/onboarding/plan-summary";
import { requireUser } from "@/server/auth/require-user";
import { getActiveProvider } from "@/server/payments/registry";
import { PlanPicker } from "./plan-picker";

export const metadata = { title: "Твоят план" };

type SearchParams = Promise<{ after?: string }>;

export default function PlanPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Plan searchParams={searchParams} />
    </Suspense>
  );
}

async function Plan({ searchParams }: { searchParams: SearchParams }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { after } = await searchParams;
  const { user, supabase } = await requireUser();
  const [
    { data: profile, error: profileError },
    { data: plans, error: plansError },
    { data: hasAccess, error: accessError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("name, goal, problems, time_per_session, level")
      .eq("id", user.id)
      .single(),
    supabase
      .from("plans")
      .select("id, name, interval, price_cents, currency")
      .eq("active", true)
      .order("sort"),
    supabase.rpc("my_access"),
  ]);
  if (profileError || plansError || accessError) {
    throw new Error(
      `load plan failed: ${(profileError ?? plansError ?? accessError)?.message ?? "unknown"}`,
    );
  }
  if (!profile) redirect("/start");
  if (hasAccess) redirect("/app");

  const summary = buildPlanSummary({
    goal: profile.goal as Goal | null,
    problems: profile.problems,
    time: profile.time_per_session as Time | null,
    level: profile.level,
  });
  const paymentsReady = (await getActiveProvider(supabase, serverEnv)).ready;

  return (
    <main className="space-y-8 px-5 pt-8">
      {after === "first" && (
        <p className="inline-block rounded-full bg-moss px-4 py-1.5 text-sm font-bold text-white">
          Първата тренировка е направена ✓
        </p>
      )}
      <header className="space-y-3">
        <p className="text-sm font-semibold text-ink-soft">
          Твоят план, {profile.name.split(" ")[0]}
        </p>
        <h1 className="font-display text-4xl font-black leading-[0.95]">{summary.headline}</h1>
      </header>

      <dl className="grid grid-cols-[1fr_1fr_1.5fr] gap-2 text-center">
        {[
          [String(summary.perWeek), "пъти седмично"],
          [summary.minutes.replace(" минути", ""), "минути"],
          [LEVEL_LABEL[profile.level], "ниво"],
        ].map(([value, label]) => (
          <div key={label} className="min-w-0 rounded-3xl bg-white px-2 py-4 ring-1 ring-line">
            <dt className="sr-only">{label}</dt>
            <dd className="font-display text-sm font-bold break-words">{value}</dd>
            <dd aria-hidden="true" className="text-xs text-ink-soft">
              {label}
            </dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2">
        <h2 className="font-semibold">Фокус</h2>
        <div className="flex flex-wrap gap-2">
          {summary.focus.map((f) => (
            <span
              key={f}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper"
            >
              {f}
            </span>
          ))}
        </div>
      </section>

      <ul className="space-y-3 text-[15px]">
        <li>✓ Стартова седмица, за да влезеш в ритъм без мускулна треска</li>
        <li>✓ Нови тренировки за твоето ниво всяка седмица</li>
        <li>✓ Цялата библиотека, по всяко време</li>
        <li>✓ Проследяване на тегло, мерки и серии</li>
      </ul>

      <PlanPicker plans={plans ?? []} ready={paymentsReady} />
    </main>
  );
}

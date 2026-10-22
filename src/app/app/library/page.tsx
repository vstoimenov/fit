import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { WorkoutCard } from "@/components/workout/workout-card";
import { FOCUS, FOCUS_LABEL, LEVEL_LABEL } from "@/lib/labels";
import { exclusiveLockLevel } from "@/lib/points/levels";
import {
  filterLibrary,
  parseLibraryFilter,
  type LibraryFilter,
} from "@/lib/program/library-filter";
import { requireUser } from "@/server/auth/require-user";
import { getMemberPointsOrNull } from "@/server/content/points";
import { getLibrary } from "@/server/content/workouts";

export const metadata = { title: "Тренировки" };

const LENGTH_LABEL = { short: "до 15 мин", mid: "16–30 мин", long: "30+ мин" } as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function chipHref(current: LibraryFilter, key: keyof LibraryFilter, value: string) {
  const next = new URLSearchParams(Object.entries(current) as [string, string][]);
  if (current[key] === value) next.delete(key);
  else next.set(key, value);
  const query = next.toString();
  return query ? `/app/library?${query}` : "/app/library";
}

function Chips({
  label,
  filter,
  keyName,
  options,
}: {
  label: string;
  filter: LibraryFilter;
  keyName: keyof LibraryFilter;
  options: Record<string, string>;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {Object.entries(options).map(([value, text]) => {
        const active = filter[keyName] === value;
        return (
          <Link
            key={value}
            href={chipHref(filter, keyName, value)}
            aria-current={active ? "true" : undefined}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Chip tone={active ? "ink" : "neutral"} className="px-4 py-2 text-sm">
              {text}
            </Chip>
          </Link>
        );
      })}
    </div>
  );
}

export default function LibraryPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Library searchParams={searchParams} />
    </Suspense>
  );
}

async function Library({ searchParams }: { searchParams: SearchParams }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const filter = parseLibraryFilter(await searchParams);
  const { supabase, user } = await requireUser();
  const [{ level, workouts }, { data: hasAccess, error: accessError }, points] = await Promise.all([
    getLibrary(supabase, user.id),
    supabase.rpc("my_access"),
    getMemberPointsOrNull(supabase, user.id),
  ]);
  if (accessError) throw new Error(`load access failed: ${accessError.message}`);
  const shown = filterLibrary(workouts, filter);

  return (
    <main className="space-y-5 px-5 pb-6 pt-8 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Тренировки</h1>
      <p className="text-sm text-ink-soft">
        Показваме тренировки за ниво {LEVEL_LABEL[level]}. Можеш да го смениш в{" "}
        <Link
          href="/app/profile"
          className="py-3 font-semibold text-ink underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          профила
        </Link>
        .
      </p>
      <div className="space-y-1">
        <Chips label="Продължителност" filter={filter} keyName="length" options={LENGTH_LABEL} />
        <Chips
          label="Фокус"
          filter={filter}
          keyName="focus"
          options={Object.fromEntries(FOCUS.map((f) => [f, FOCUS_LABEL[f]]))}
        />
      </div>
      {shown.length === 0 ? (
        <Card className="p-5 text-ink-soft">Няма тренировки с тези филтри.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((w) => (
            <WorkoutCard
              key={w.id}
              workout={w}
              locked={!hasAccess && w.kind !== "free"}
              unlockLevel={points ? exclusiveLockLevel(w.minMemberLevel, points.level) : null}
            />
          ))}
        </div>
      )}
    </main>
  );
}

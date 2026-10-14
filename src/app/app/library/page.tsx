import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { WorkoutCard } from "@/components/workout/workout-card";
import { cn } from "@/lib/cn";
import { FOCUS, FOCUS_LABEL, LEVEL_LABEL } from "@/lib/labels";
import {
  filterLibrary,
  parseLibraryFilter,
  type LibraryFilter,
} from "@/lib/program/library-filter";
import { requireUser } from "@/server/auth/require-user";
import { listPublishedWorkouts } from "@/server/content/workouts";

export const metadata = { title: "Библиотека" };

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
  filter,
  keyName,
  options,
}: {
  filter: LibraryFilter;
  keyName: keyof LibraryFilter;
  options: Record<string, string>;
}) {
  return (
    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {Object.entries(options).map(([value, label]) => (
        <Link
          key={value}
          href={chipHref(filter, keyName, value)}
          className={cn(
            "shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold",
            filter[keyName] === value ? "border-ink bg-ink text-paper" : "border-line bg-white",
          )}
        >
          {label}
        </Link>
      ))}
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
  const { supabase } = await requireUser();
  const [workouts, { data: hasAccess, error: accessError }] = await Promise.all([
    listPublishedWorkouts(supabase),
    supabase.rpc("my_access"),
  ]);
  if (accessError) throw new Error(`load access failed: ${accessError.message}`);
  const shown = filterLibrary(workouts, filter);

  return (
    <main className="space-y-5 px-5 pt-8">
      <h1 className="font-display text-3xl font-bold">Библиотека</h1>
      <Chips filter={filter} keyName="level" options={LEVEL_LABEL} />
      <Chips filter={filter} keyName="length" options={LENGTH_LABEL} />
      <Chips
        filter={filter}
        keyName="focus"
        options={Object.fromEntries(FOCUS.map((f) => [f, FOCUS_LABEL[f]]))}
      />
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-ink/5 p-5 text-ink-soft">Няма тренировки с тези филтри.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((w) => (
            <WorkoutCard key={w.id} workout={w} locked={!hasAccess && w.kind !== "free"} />
          ))}
        </div>
      )}
    </main>
  );
}

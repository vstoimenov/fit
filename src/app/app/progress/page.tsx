import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { PhotoUpload } from "@/components/photos/photo-upload";
import { Sparkline } from "@/components/progress/sparkline";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import { listProgressPhotos } from "@/server/progress/photos";

export const metadata = { title: "Прогрес" };

type SearchParams = Promise<{ saved?: string }>;

const dateFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Sofia",
});

export default function ProgressPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Progress searchParams={searchParams} />
    </Suspense>
  );
}

async function Progress({ searchParams }: { searchParams: SearchParams }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { saved } = await searchParams;
  const { user, supabase } = await requireUser();
  const [{ data: profile, error: profileError }, { data: checkIns, error: checkInsError }, photos] =
    await Promise.all([
      supabase.from("profiles").select("weight_kg, target_weight_kg").eq("id", user.id).single(),
      supabase
        .from("check_ins")
        .select("created_at, weight_kg, waist_cm")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      // A photo failure (e.g. signing) must not take down the weight and waist charts.
      listProgressPhotos(supabase, { limit: 6 }).catch((error: unknown) => {
        console.error("progress photos failed to load", error);
        return null;
      }),
    ]);
  const loadError = profileError ?? checkInsError;
  if (loadError) throw new Error(`load progress failed: ${loadError.message}`);
  const newestFirst = checkIns ?? [];
  // Newest 30, charted oldest to newest.
  const recent = [...newestFirst].reverse();
  const weights = recent.map((c) => c.weight_kg).filter((w): w is number => w !== null);
  const waists = recent.map((c) => c.waist_cm).filter((w): w is number => w !== null);

  return (
    <main className="space-y-8 px-5 pt-8 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl">Прогрес</h1>
        <Link href="/app/check-in" className={buttonClass("primary", "md")}>
          Отбележи седмицата
        </Link>
      </header>
      {saved && (
        <p role="status" className="rounded-2xl bg-moss/15 px-4 py-3 font-semibold text-moss">
          Прогресът е записан ✓
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Тегло</h2>
            <p className="text-sm text-ink-soft">
              {weights.at(-1) ?? profile?.weight_kg ?? "—"} кг · цел{" "}
              {profile?.target_weight_kg ?? "—"} кг
            </p>
          </div>
          <Sparkline points={weights} label="Тегло във времето" />
        </Card>
        <Card className="space-y-3 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Талия</h2>
            <p className="text-sm text-ink-soft">{waists.at(-1) ?? "—"} см</p>
          </div>
          <Sparkline points={waists} label="Талия във времето" />
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Снимки</h2>
          {photos && photos.length > 0 && (
            <Link href="/app/progress/photos" className={buttonClass("link")}>
              Всички снимки
            </Link>
          )}
        </div>
        {photos === null ? (
          <p role="alert" className="text-ink-soft">
            Снимките не се заредиха. Опитай пак по-късно.
          </p>
        ) : photos.length > 0 ? (
          <PhotoGrid photos={photos} />
        ) : (
          <p className="text-ink-soft">
            Първата снимка е най-важната — след месец ще се радваш, че я имаш.
          </p>
        )}
        <PhotoUpload userId={user.id} today={sofiaToday()} variant="secondary" />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Последни отчети</h2>
        {newestFirst.length === 0 ? (
          <p className="text-ink-soft">Още няма отбелязани седмици. Първата отнема минута.</p>
        ) : (
          <ul className="divide-y divide-line rounded-2xl ring-1 ring-line">
            {newestFirst.slice(0, 8).map((c) => (
              <li
                key={c.created_at}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="font-semibold">{dateFormat.format(new Date(c.created_at))}</span>
                <span className="text-ink-soft">
                  {c.weight_kg !== null ? `${c.weight_kg} кг` : "—"}
                  {c.waist_cm !== null && ` · талия ${c.waist_cm} см`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DeletePhoto } from "@/components/photos/delete-photo";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PhotoShare } from "@/components/photos/photo-share";
import { serverEnv } from "@/env";
import { formatLongDate } from "@/lib/progress-photos/format-date";
import { requireUser } from "@/server/auth/require-user";
import { getProgressPhoto, listProgressPhotos } from "@/server/progress/photos";

export const metadata = { title: "Снимка" };

export default function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PhotoScreen params={params} />
    </Suspense>
  );
}

function siteHost(appUrl: string): string {
  try {
    return new URL(appUrl).host;
  } catch {
    return "";
  }
}

async function PhotoScreen({ params }: { params: Promise<{ id: string }> }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { id } = await params;
  const { supabase } = await requireUser();
  const [photo, all] = await Promise.all([
    getProgressPhoto(supabase, id),
    listProgressPhotos(supabase),
  ]);
  if (!photo) notFound();

  // Her other photos from before or the same day. Without a working link there is nothing to draw.
  const candidates = all
    .filter((p) => p.id !== photo.id && p.takenOn <= photo.takenOn)
    .flatMap((p) => (p.url ? [{ id: p.id, url: p.url, takenOn: p.takenOn }] : []));

  // On her oldest photo there is nothing to compare with; say so instead of hiding „Преди / След" silently.
  const isOldest =
    all.length > 1 && !all.some((p) => p.id !== photo.id && p.takenOn <= photo.takenOn);

  return (
    <main className="space-y-6 px-5 pb-8 pt-4 lg:px-8">
      <div className="space-y-1">
        <Link
          href="/app/progress/photos"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          Всички снимки
        </Link>
        <h1 className="font-display text-3xl">{formatLongDate(photo.takenOn)}</h1>
      </div>

      {photo.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
        <img
          src={photo.url}
          alt={`Снимка от ${formatLongDate(photo.takenOn)}`}
          className="mx-auto max-h-[70dvh] w-auto max-w-full rounded-2xl object-contain"
        />
      ) : null}

      {isOldest && (
        <p className="text-sm text-ink-soft">За „Преди / След“ отвори по-нова снимка.</p>
      )}

      <PhotoShare
        after={{ url: photo.url, takenOn: photo.takenOn }}
        candidates={candidates}
        host={siteHost(serverEnv.APP_URL)}
        siteUrl={serverEnv.APP_URL}
      />

      <DeletePhoto id={photo.id} />
    </main>
  );
}

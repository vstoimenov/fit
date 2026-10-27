import { connection } from "next/server";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PhotoGrid } from "@/components/photos/photo-grid";
import { PhotoUpload } from "@/components/photos/photo-upload";
import { sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import { listProgressPhotos } from "@/server/progress/photos";

export const metadata = { title: "Снимки на прогреса" };

export default function PhotosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Photos />
    </Suspense>
  );
}

async function Photos() {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { user, supabase } = await requireUser();
  const photos = await listProgressPhotos(supabase);

  return (
    <main className="space-y-6 px-5 pt-8 lg:px-8">
      <header className="space-y-1">
        <h1 className="font-display text-3xl">Снимки на прогреса</h1>
        <p className="text-ink-soft">Снимките виждаш само ти.</p>
      </header>

      <PhotoUpload userId={user.id} today={sofiaToday()} />

      {photos.length === 0 ? (
        <p className="rounded-2xl bg-sand p-5 font-semibold">
          Първата снимка е най-важната — след месец ще се радваш, че я имаш.
        </p>
      ) : (
        <PhotoGrid photos={photos} />
      )}
    </main>
  );
}

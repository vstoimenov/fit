import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Composer } from "@/components/community/composer";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PostCard } from "@/components/community/post-card";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/auth/require-user";
import { listFeed } from "@/server/community/feed";

export const metadata = { title: "Общност" };

type SearchParams = Promise<{
  before?: string | string[];
  share?: string | string[];
  title?: string | string[];
}>;

export default function CommunityPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Community searchParams={searchParams} />
    </Suspense>
  );
}

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

async function Community({ searchParams }: { searchParams: SearchParams }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const params = await searchParams;
  const rawBefore = str(params.before);
  // A garbage cursor would make the RPC raise 22023; treat it as the first page.
  const before = rawBefore && Number.isFinite(Date.parse(rawBefore)) ? rawBefore : null;
  const shareCompletion = /^[0-9a-f-]{36}$/i.test(str(params.share)) ? str(params.share) : null;
  const shareTitle = str(params.title).slice(0, 120);
  const { user, supabase } = await requireUser();
  // The feed RPC refuses without access anyway; asking for both at once saves a round trip.
  const [{ data: hasAccess, error: accessError }, feedResult] = await Promise.all([
    supabase.rpc("my_access"),
    listFeed(supabase, before).then(
      (feed) => ({ feed, error: null as unknown }),
      (error: unknown) => ({ feed: null, error }),
    ),
  ]);
  if (accessError) throw new Error(`load access failed: ${accessError.message}`);

  if (!hasAccess) {
    return (
      <main className="space-y-6 px-5 pb-6 pt-8 lg:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight">Общност</h1>
        <Card className="space-y-3 p-5">
          <p className="text-ink-soft">
            Общността е за абонатки: там споделяме прогрес и се подкрепяме.
          </p>
          <Link href="/app/plan" className={`${buttonClass("primary", "md")} w-full`}>
            Виж плановете
          </Link>
        </Card>
      </main>
    );
  }

  if (feedResult.error || !feedResult.feed) throw feedResult.error;
  const { posts, hasMore } = feedResult.feed;
  const last = posts.at(-1);

  return (
    <main className="space-y-5 px-5 pb-6 pt-8 lg:mx-auto lg:max-w-2xl lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Общност</h1>
      {!before && (
        <Composer
          userId={user.id}
          initialBody={shareCompletion ? `Завърших „${shareTitle || "тренировката"}“ 💪` : ""}
          completionId={shareCompletion}
        />
      )}
      {posts.length === 0 ? (
        <Card className="p-5 text-ink-soft">
          {before ? "Това е всичко засега." : "Още няма публикации. Бъди първата!"}
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
      {hasMore && last && (
        <Link
          href={`/app/community?before=${encodeURIComponent(last.createdAt)}`}
          className={`${buttonClass("secondary", "md")} w-full`}
        >
          Още публикации
        </Link>
      )}
    </main>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChallengeCard } from "@/components/challenges/challenge-card";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import { listMemberChallenges, type MemberChallengeItem } from "@/server/challenges/challenges";

export const metadata = { title: "Предизвикателства" };

export default function ChallengesPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh px-5 pt-8" aria-busy="true" />}>
      <Challenges />
    </Suspense>
  );
}

async function Challenges() {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { user, supabase } = await requireUser();
  const [list, access] = await Promise.all([
    listMemberChallenges(supabase, user.id, sofiaToday()),
    supabase.rpc("my_access"),
  ]);
  if (access.error) throw new Error(`check access failed: ${access.error.message}`);
  const hasAccess = access.data === true;
  const empty =
    list.running.length === 0 && list.upcoming.length === 0 && list.joinedFinished.length === 0;

  return (
    <main className="space-y-6 px-5 pb-6 pt-8 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Предизвикателства</h1>

      {!hasAccess && (
        <section className="space-y-3 rounded-2xl bg-sand p-5">
          <p className="font-semibold">Предизвикателствата са достъпни с активен абонамент.</p>
          <Link href="/app/plan" className={`${buttonClass("primary", "md")} w-full`}>
            Виж плановете
          </Link>
        </section>
      )}

      {empty ? (
        hasAccess && <Card className="p-5 text-ink-soft">Скоро тук ще има предизвикателства.</Card>
      ) : (
        <>
          <Group id="running" title="Тече сега" items={list.running} />
          <Group id="upcoming" title="Предстоят" items={list.upcoming} />
          <Group id="finished" title="Завършени" items={list.joinedFinished} />
        </>
      )}
    </main>
  );
}

function Group({ id, title, items }: { id: string; title: string; items: MemberChallengeItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <h2 id={`${id}-heading`} className="text-xl font-extrabold tracking-tight">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <ChallengeCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Board } from "@/components/challenges/board";
import { BoardToggle } from "@/components/challenges/board-toggle";
import { ChallengeDays } from "@/components/challenges/challenge-days";
import { JoinButton } from "@/components/challenges/join-button";
import { ArticleBody } from "@/components/learn/article-body";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ImageShareButton } from "@/components/workout/share-button";
import {
  challengeShareText,
  dayLabel,
  participantsLabel,
  progressLabel,
} from "@/lib/challenges/format";
import { canStillTick } from "@/lib/challenges/calendar";
import { sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import { getChallengeView } from "@/server/challenges/challenges";

export const metadata = { title: "Предизвикателство" };

type Params = Promise<{ id: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const backLinkClass =
  "inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export default function ChallengePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Challenge params={params} />
    </Suspense>
  );
}

function PlanCta({ text }: { text: string }) {
  return (
    <section className="space-y-3 rounded-2xl bg-sand p-5">
      <p className="font-semibold">{text}</p>
      <Link href="/app/plan" className={`${buttonClass("primary", "md")} w-full`}>
        Виж плановете
      </Link>
    </section>
  );
}

function percent(p: { done: number; total: number }): number {
  return p.total > 0 ? Math.round(Math.min(1, p.done / p.total) * 100) : 0;
}

async function Challenge({ params }: { params: Params }) {
  // Opt out of prerendering before the session read (see src/app/start/page.tsx).
  await connection();
  const { id } = await params;
  const { user, supabase } = await requireUser();
  // A malformed id would be a database error, not a missing row.
  if (!UUID.test(id)) notFound();

  const today = sofiaToday();
  const view = await getChallengeView(supabase, user.id, id, today);
  if (!view) {
    // RLS hides published challenges from a lapsed member: tell her why instead of a bare 404.
    const { data: hasAccess, error } = await supabase.rpc("my_access");
    if (error) throw new Error(`check access failed: ${error.message}`);
    if (hasAccess === true) notFound();
    return (
      <main className="mx-auto max-w-2xl space-y-5 px-5 pb-10 pt-4 lg:mx-0 lg:px-8">
        <Link href="/app/challenges" className={backLinkClass}>
          ← Предизвикателства
        </Link>
        <PlanCta text="Предизвикателствата са достъпни с активен абонамент." />
      </main>
    );
  }

  const { challenge, participation, progress, hasAccess } = view;
  const joined = participation !== null;
  const open = challenge.status !== "ended";

  return (
    <main className="space-y-6 px-5 pb-6 pt-4 lg:px-8">
      <Link href="/app/challenges" className={backLinkClass}>
        ← Предизвикателства
      </Link>

      <header className="space-y-3">
        <h1 className="break-words text-3xl font-extrabold tracking-tight">{challenge.title}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-soft">
          <Chip tone="powder">
            {dayLabel(challenge.status, challenge.day, challenge.days, challenge.startDate)}
          </Chip>
          <span>{participantsLabel(challenge.participants)}</span>
        </p>
      </header>

      {challenge.description.trim() !== "" && <ArticleBody body={challenge.description} />}

      {!joined && open && hasAccess && <JoinButton challengeId={challenge.id} />}
      {/* A lapsed participant is only pitched the plan while a tick could still be missed. */}
      {!hasAccess && joined && canStillTick(challenge.startDate, challenge.days, today) && (
        <PlanCta text="Отмятането е достъпно с активен абонамент." />
      )}
      {!hasAccess && !joined && open && (
        <PlanCta text="Включването е достъпно с активен абонамент." />
      )}

      {progress && (
        <section aria-label="Напредък" className="space-y-2 rounded-2xl bg-sand p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-extrabold">Твоят напредък</p>
            <p className="text-sm font-semibold text-ink-soft">{progressLabel(progress)}</p>
          </div>
          <div
            role="progressbar"
            aria-label="Твоят напредък"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent(progress)}
            aria-valuetext={progressLabel(progress)}
            className="h-2 overflow-hidden rounded-full bg-white"
          >
            <div
              className="h-full rounded-full bg-powder"
              style={{ width: `${percent(progress)}%` }}
            />
          </div>
        </section>
      )}

      {progress?.finished && (
        <section
          aria-labelledby="finished-heading"
          className="space-y-3 rounded-2xl bg-powder-light p-5"
        >
          <h2 id="finished-heading" className="text-2xl font-extrabold tracking-tight">
            Завърши предизвикателството!
          </h2>
          <p className="text-ink-soft">Отметна всеки свой ден. Браво, ти успя!</p>
          <ImageShareButton
            src={`/api/share/challenge/${encodeURIComponent(challenge.id)}?format=story`}
            fileName="predizvikatelstvo.png"
            text={challengeShareText(challenge.title, progress.total)}
          />
        </section>
      )}

      <ChallengeDays
        challengeId={challenge.id}
        days={view.days}
        todayDay={challenge.day}
        total={challenge.days}
        canTick={joined && hasAccess}
      />

      {(joined || view.board.length > 0) && (
        <section aria-labelledby="board-heading" className="space-y-3">
          <h2 id="board-heading" className="text-xl font-extrabold tracking-tight">
            Класация
          </h2>
          <Board rows={view.board} />
          {participation && (
            <BoardToggle challengeId={challenge.id} show={participation.showOnBoard} />
          )}
        </section>
      )}
    </main>
  );
}

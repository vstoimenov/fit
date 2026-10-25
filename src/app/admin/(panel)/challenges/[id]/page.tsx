import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { Chip } from "@/components/ui/chip";
import { getChallenge, listPublishedWorkouts } from "@/server/admin/challenges";
import { requireAdmin } from "@/server/admin/require-admin";
import { updateChallengeAction } from "../actions";
import { ChallengeForm } from "../challenge-form";

export const metadata = { title: "Предизвикателство" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };

export default function EditChallengePage(props: Props) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <EditChallenge {...props} />
    </Suspense>
  );
}

async function EditChallenge({ params, searchParams }: Props) {
  await connection();
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const [challenge, workouts] = await Promise.all([
    z.uuid().safeParse(id).success ? getChallenge(supabase, id) : null,
    listPublishedWorkouts(supabase),
  ]);
  if (!challenge) notFound();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">{challenge.title}</h1>
        <Chip tone={challenge.published ? "powder" : "neutral"}>
          {challenge.published ? "Публикувано" : "Чернова"}
        </Chip>
      </header>
      {saved && (
        <p role="status" className="text-moss">
          Създадено ✓
        </p>
      )}
      <ChallengeForm
        action={updateChallengeAction.bind(null, challenge.id)}
        challenge={challenge}
        workouts={workouts}
      />
    </div>
  );
}

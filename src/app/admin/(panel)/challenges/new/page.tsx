import { Suspense } from "react";
import { listPublishedWorkouts } from "@/server/admin/challenges";
import { requireAdmin } from "@/server/admin/require-admin";
import { connection } from "next/server";
import { createChallengeAction } from "../actions";
import { ChallengeForm } from "../challenge-form";

export const metadata = { title: "Ново предизвикателство" };

export default function NewChallengePage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <NewChallenge />
    </Suspense>
  );
}

async function NewChallenge() {
  await connection();
  const { supabase } = await requireAdmin();
  const workouts = await listPublishedWorkouts(supabase);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Ново предизвикателство</h1>
      <ChallengeForm action={createChallengeAction} workouts={workouts} />
    </div>
  );
}

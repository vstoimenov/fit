import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { StatusBadge } from "@/components/admin/status-badge";
import { requireAdmin } from "@/server/admin/require-admin";
import { getAdminWorkout } from "@/server/admin/workouts";
import { updateWorkoutAction } from "../actions";
import { WorkoutForm } from "../workout-form";

export const metadata = { title: "Тренировка" };

export default function EditWorkoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <EditWorkout params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditWorkout({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await connection();
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const workout = /^[0-9a-f-]{36}$/i.test(id) ? await getAdminWorkout(supabase, id) : null;
  if (!workout) notFound();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">{workout.title}</h1>
        <StatusBadge status={workout.status} />
        <span className="text-sm text-ink-soft">{workout.completions} завършвания</span>
      </header>
      {saved && <p className="text-moss">Създадена ✓</p>}
      <WorkoutForm action={updateWorkoutAction.bind(null, workout.id)} workout={workout} />
    </div>
  );
}

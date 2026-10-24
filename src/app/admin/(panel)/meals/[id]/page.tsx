import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { Chip } from "@/components/ui/chip";
import { getMeal } from "@/server/admin/meals";
import { requireAdmin } from "@/server/admin/require-admin";
import { updateMealAction } from "../actions";
import { MealForm } from "../meal-form";

export const metadata = { title: "Ястие" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> };

export default function EditMealPage(props: Props) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <EditMeal {...props} />
    </Suspense>
  );
}

async function EditMeal({ params, searchParams }: Props) {
  await connection();
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const { supabase } = await requireAdmin();
  const meal = z.uuid().safeParse(id).success ? await getMeal(supabase, id) : null;
  if (!meal) notFound();
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">{meal.title}</h1>
        <Chip tone={meal.published ? "powder" : "neutral"}>
          {meal.published ? "Публикувано" : "Чернова"}
        </Chip>
      </header>
      {saved && (
        <p role="status" className="text-moss">
          Създадено ✓
        </p>
      )}
      <MealForm action={updateMealAction.bind(null, meal.id)} meal={meal} />
    </div>
  );
}

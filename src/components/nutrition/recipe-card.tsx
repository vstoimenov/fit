import Link from "next/link";
import { ArticleCover } from "@/components/learn/article-card";
import { formatNumber } from "@/lib/nutrition/format";
import type { Meal } from "@/lib/nutrition/meal-schema";
import { totalMinutes } from "@/lib/nutrition/recipe";

/** A recipe tile in Полезно: photo, title, time and calories per portion. */
export function RecipeCard({ meal }: { meal: Meal }) {
  const total = totalMinutes(meal.prepMin, meal.cookMin);
  return (
    <Link
      href={`/app/nutrition/recipe/${meal.id}`}
      className="group block overflow-hidden rounded-2xl bg-white ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {meal.photoUrl ? (
        <ArticleCover
          src={meal.photoUrl}
          sizes="(min-width:1024px) 320px, (min-width:640px) 50vw, 100vw"
          className="aspect-[4/3]"
        />
      ) : (
        <div className="aspect-[4/3] bg-powder-chip" aria-hidden="true" />
      )}
      <div className="space-y-1 p-4">
        <p className="font-extrabold leading-snug group-hover:underline">{meal.title}</p>
        <p className="text-sm text-ink-soft">
          {total !== null ? `${total} мин · ` : ""}≈ {formatNumber(meal.kcal)} ккал на порция
        </p>
      </div>
    </Link>
  );
}

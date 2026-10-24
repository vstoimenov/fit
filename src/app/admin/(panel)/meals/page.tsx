import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import {
  DIET_LABEL,
  DIETS,
  MEAL_LABEL,
  MEAL_SLOTS,
  type Diet,
  type MealSlot,
} from "@/lib/nutrition/labels";
import { mealFits } from "@/lib/nutrition/menu";
import { listMeals, mealCoverage } from "@/server/admin/meals";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Ястия" };

type Search = { type?: string; diet?: string; status?: string };
type Props = { searchParams: Promise<Search> };

const STATUSES = ["published", "draft"] as const;
const STATUS_LABEL = { published: "Публикувани", draft: "Чернови" } as const;

type Filters = { type?: MealSlot; diet?: Diet; status?: (typeof STATUSES)[number] };

function readFilters(search: Search): Filters {
  return {
    type: MEAL_SLOTS.find((slot) => slot === search.type),
    diet: DIETS.find((diet) => diet === search.diet),
    status: STATUSES.find((status) => status === search.status),
  };
}

function href(filters: Filters, change: Partial<Record<keyof Filters, string | undefined>>) {
  const params = new URLSearchParams();
  const merged = { ...filters, ...change };
  for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `/admin/meals?${query}` : "/admin/meals";
}

export default function MealsPage(props: Props) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Meals {...props} />
    </Suspense>
  );
}

function FilterGroup({
  label,
  current,
  options,
  filters,
  name,
}: {
  label: string;
  current: string | undefined;
  options: { value: string; label: string }[];
  filters: Filters;
  name: keyof Filters;
}) {
  const all = { value: "", label: "Всички" };
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="w-20 text-sm font-semibold text-ink-soft">{label}</span>
      {[all, ...options].map((option) => {
        const active = (current ?? "") === option.value;
        return (
          <Link
            key={option.value}
            href={href(filters, { [name]: option.value || undefined })}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold",
              active ? "bg-ink text-white" : "bg-sand text-ink",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

async function Meals({ searchParams }: Props) {
  await connection();
  const filters = readFilters(await searchParams);
  const { supabase } = await requireAdmin();
  const meals = await listMeals(supabase);

  const coverage = mealCoverage(meals);
  const shown = meals.filter(
    (meal) =>
      (!filters.type || meal.mealTypes.includes(filters.type)) &&
      (!filters.diet ||
        mealFits(meal, { diet: filters.diet, allergens: [], avoidFoods: "", mealsPerDay: 3 })) &&
      (!filters.status || meal.published === (filters.status === "published")),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Ястия</h1>
        <Link href="/admin/meals/new" className={buttonClass("primary", "md")}>
          Ново ястие
        </Link>
      </header>

      <section aria-labelledby="coverage-title" className="space-y-2">
        <h2 id="coverage-title" className="text-sm font-semibold">
          Покритие: публикувани ястия за всяка диета и вид
        </h2>
        <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-ink-soft">
              <tr>
                <th scope="col" className="p-3">
                  Диета
                </th>
                {MEAL_SLOTS.map((slot) => (
                  <th key={slot} scope="col" className="p-3 text-center">
                    {MEAL_LABEL[slot]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIETS.map((diet) => (
                <tr key={diet} className="border-t border-line">
                  <th scope="row" className="p-3 font-semibold">
                    {DIET_LABEL[diet]}
                  </th>
                  {MEAL_SLOTS.map((slot) => {
                    const count =
                      coverage.find((c) => c.diet === diet && c.meal === slot)?.count ?? 0;
                    return (
                      <td
                        key={slot}
                        className={cn(
                          "p-3 text-center tabular-nums",
                          count === 0 ? "bg-sand text-ink-soft" : "font-semibold",
                        )}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Филтри" className="space-y-1">
        <FilterGroup
          label="Вид"
          name="type"
          current={filters.type}
          filters={filters}
          options={MEAL_SLOTS.map((slot) => ({ value: slot, label: MEAL_LABEL[slot] }))}
        />
        <FilterGroup
          label="Диета"
          name="diet"
          current={filters.diet}
          filters={filters}
          options={DIETS.map((diet) => ({ value: diet, label: DIET_LABEL[diet] }))}
        />
        <FilterGroup
          label="Статус"
          name="status"
          current={filters.status}
          filters={filters}
          options={STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] }))}
        />
      </section>

      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th scope="col" className="p-3">
                Ястие
              </th>
              <th scope="col" className="p-3">
                Вид
              </th>
              <th scope="col" className="p-3">
                Ккал
              </th>
              <th scope="col" className="p-3">
                Статус
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((meal) => (
              <tr key={meal.id} className="border-t border-line">
                <td className="p-3">
                  <Link
                    href={`/admin/meals/${meal.id}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {meal.title}
                  </Link>
                </td>
                <td className="p-3">{meal.mealTypes.map((slot) => MEAL_LABEL[slot]).join(", ")}</td>
                <td className="p-3 tabular-nums">{meal.kcal}</td>
                <td className="p-3">
                  <Chip tone={meal.published ? "powder" : "neutral"}>
                    {meal.published ? "Публикувано" : "Чернова"}
                  </Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && (
          <p className="p-4 text-ink-soft">
            {meals.length === 0 ? "Още няма ястия." : "Няма ястия с тези филтри."}
          </p>
        )}
      </div>
    </div>
  );
}

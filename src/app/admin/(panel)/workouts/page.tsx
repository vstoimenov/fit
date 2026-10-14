import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LevelBadge } from "@/components/admin/level-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import { LEVEL_LABEL } from "@/lib/labels";
import type { Level, WorkoutKind } from "@/lib/program/types";
import { requireAdmin } from "@/server/admin/require-admin";
import { listAdminWorkouts } from "@/server/admin/workouts";
import type { WorkoutStatus } from "@/lib/admin/calendar";
import { StarterOrder } from "./starter-order";

export const metadata = { title: "Тренировки" };
type Search = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default function WorkoutsPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Workouts searchParams={searchParams} />
    </Suspense>
  );
}

async function Workouts({ searchParams }: { searchParams: Search }) {
  await connection();
  const sp = await searchParams;
  const level = one(sp.level) as Level | undefined;
  const kind = one(sp.kind) as WorkoutKind | undefined;
  const status = one(sp.status) as WorkoutStatus | undefined;
  const search = one(sp.q)?.slice(0, 60);
  const { supabase } = await requireAdmin();
  const filter = {
    level: level && level in LEVEL_LABEL ? level : undefined,
    kind: kind && ["free", "starter", "regular"].includes(kind) ? kind : undefined,
    status: status && ["draft", "scheduled", "published"].includes(status) ? status : undefined,
    search,
  };
  const [workouts, starters] = await Promise.all([
    listAdminWorkouts(supabase, filter),
    listAdminWorkouts(supabase, { kind: "starter" }),
  ]);
  starters.sort((a, b) => (a.starterOrder ?? 0) - (b.starterOrder ?? 0));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Тренировки</h1>
        <Link href="/admin/workouts/new" className={buttonClass("primary", "md")}>
          Нова
        </Link>
      </header>
      <form className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={search}
          placeholder="Търси по заглавие"
          className={inputClass + " max-w-xs"}
        />
        <select
          name="level"
          defaultValue={filter.level ?? ""}
          className={inputClass + " max-w-[10rem]"}
        >
          <option value="">Всички нива</option>
          {Object.entries(LEVEL_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={filter.status ?? ""}
          className={inputClass + " max-w-[10rem]"}
        >
          <option value="">Всички статуси</option>
          <option value="draft">Чернови</option>
          <option value="scheduled">Планирани</option>
          <option value="published">Публикувани</option>
        </select>
        <button className={buttonClass("quiet", "md")}>Филтрирай</button>
      </form>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-ink-soft">
            <tr>
              <th className="p-3">Заглавие</th>
              <th className="p-3">Ниво</th>
              <th className="p-3">Статус</th>
              <th className="p-3">Публикуване</th>
              <th className="p-3">Мин</th>
              <th className="p-3">Завършвания</th>
            </tr>
          </thead>
          <tbody>
            {workouts.map((w) => (
              <tr key={w.id} className="border-t border-line">
                <td className="p-3">
                  <Link
                    href={`/admin/workouts/${w.id}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {w.title}
                  </Link>
                </td>
                <td className="p-3">
                  <LevelBadge level={w.level} />
                </td>
                <td className="p-3">
                  <StatusBadge status={w.status} />
                </td>
                <td className="p-3 tabular-nums">
                  {w.publishAt
                    ? `${utcToZoned(w.publishAt).date} ${utcToZoned(w.publishAt).time}`
                    : "—"}
                </td>
                <td className="p-3 tabular-nums">{w.durationMin}</td>
                <td className="p-3 tabular-nums">{w.completions}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {workouts.length === 0 && (
          <p className="p-4 text-ink-soft">Няма тренировки с тези филтри.</p>
        )}
      </div>
      {starters.length > 0 && <StarterOrder starters={starters} />}
    </div>
  );
}

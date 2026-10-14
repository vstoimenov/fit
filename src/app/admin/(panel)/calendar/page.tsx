import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { levelGaps, monthGrid, weekOf } from "@/lib/admin/calendar";
import { addDays, formatDateBg, utcToZoned } from "@/lib/admin/time";
import { LEVEL_LABEL } from "@/lib/labels";
import { requireAdmin } from "@/server/admin/require-admin";
import { listAdminWorkouts } from "@/server/admin/workouts";
import { BulkAdd } from "./bulk-add";
import { MonthView } from "./month-view";

export const metadata = { title: "Календар" };
type Search = Promise<{ m?: string; view?: string; d?: string }>;

export default function CalendarPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Calendar searchParams={searchParams} />
    </Suspense>
  );
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

async function Calendar({ searchParams }: { searchParams: Search }) {
  await connection();
  const sp = await searchParams;
  const now = new Date();
  const today = utcToZoned(now.toISOString()).date;
  const week = sp.view === "week";
  const anchor =
    sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) && !Number.isNaN(Date.parse(sp.d)) ? sp.d : today;
  const month = sp.m && /^(\d{4})-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : today.slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const weeks = week ? [weekOf(anchor)] : monthGrid(y!, m!);

  const { supabase } = await requireAdmin();
  const workouts = await listAdminWorkouts(supabase, {}, now);
  const byDate: Record<string, ((typeof workouts)[number] & { localTime: string })[]> = {};
  for (const w of workouts) {
    if (!w.publishAt) continue;
    const local = utcToZoned(w.publishAt);
    (byDate[local.date] ??= []).push({ ...w, localTime: local.time });
  }
  for (const list of Object.values(byDate))
    list.sort((a, b) => a.localTime.localeCompare(b.localTime));
  const gaps = levelGaps(workouts, now, 7);
  const drafts = workouts.filter((w) => w.status === "draft" && w.kind === "regular");

  const prevHref = week ? `?view=week&d=${addDays(anchor, -7)}` : `?m=${shiftMonth(month, -1)}`;
  const nextHref = week ? `?view=week&d=${addDays(anchor, 7)}` : `?m=${shiftMonth(month, 1)}`;
  const label = week
    ? `${formatDateBg(weeks[0]![0]!)} – ${formatDateBg(weeks[0]![6]!)}`
    : new Intl.DateTimeFormat("bg-BG", { month: "long", year: "numeric", timeZone: "UTC" }).format(
        new Date(`${month}-01T12:00:00Z`),
      );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-2xl font-bold">Календар</h1>
        <Link href={prevHref} aria-label="Назад" className={buttonClass("quiet", "md")}>
          ←
        </Link>
        <span className="font-semibold tabular-nums first-letter:uppercase">{label}</span>
        <Link href={nextHref} aria-label="Напред" className={buttonClass("quiet", "md")}>
          →
        </Link>
        <Link
          href={week ? `?m=${anchor.slice(0, 7)}` : `?view=week&d=${today}`}
          className={buttonClass("ghost", "md")}
        >
          {week ? "Месец" : "Седмица"}
        </Link>
      </header>

      {gaps.length > 0 && (
        <ul className="space-y-1 rounded-2xl bg-mustard/15 p-4 text-sm">
          {gaps.map((g) => (
            <li key={g.level}>
              ⚠ Ниво „{LEVEL_LABEL[g.level]}“{" "}
              {g.lastAt
                ? `няма планирано съдържание след ${formatDateBg(utcToZoned(g.lastAt).date)}`
                : "няма нито една тренировка"}
              .
            </li>
          ))}
        </ul>
      )}

      <MonthView
        weeks={weeks}
        month={week ? "" : month}
        today={today}
        byDate={byDate}
        drafts={drafts.map((w) => ({ id: w.id, title: w.title }))}
      />

      <BulkAdd today={today} />
    </div>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { AttendanceToggle } from "@/components/admin/studio/attendance-toggle";
import { DoorAdd } from "@/components/admin/studio/door-add";
import { SlotFields } from "@/components/admin/studio/slot-fields";
import { WalkInFields } from "@/components/admin/studio/walkin-fields";
import { Chip } from "@/components/ui/chip";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { utcToZoned, zonedToUtc } from "@/lib/admin/time";
import { nextDates } from "@/lib/studio/calendar";
import { dayLabel, rosterLabel } from "@/lib/studio/format";
import { attendanceLine, cashLine, telHref } from "@/lib/studio/today";
import { cardLine, dayMonth } from "@/lib/studio/rules";
import { requireAdmin } from "@/server/admin/require-admin";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { getStudioAddress } from "@/server/studio/address";
import { listStudioSlots } from "@/server/studio/admin";
import { listStudioClients } from "@/server/studio/cards";
import { ensureStudioSessions, listStudioSchedule } from "@/server/studio/schedule";
import { boardDate, listDayBoard } from "@/server/studio/today";
import { addWalkInAction, saveSlotAction, saveStudioAddressAction } from "./actions";

export const metadata = { title: "На място" };

const TABS = [
  { key: "dnes", label: "Днес" },
  { key: "trenirovki", label: "Тренировки" },
  { key: "minali", label: "Минали" },
  { key: "klientki", label: "Клиентки" },
  { key: "grafik", label: "График" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function StudioAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <StudioAdmin searchParams={searchParams} />
    </Suspense>
  );
}

async function StudioAdmin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await connection();
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : "dnes";
  const { supabase } = await requireAdmin();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Тренировки на място</h1>
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/zala?tab=${t.key}`}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line",
              t.key === tab ? "bg-ink text-white ring-ink" : "bg-white",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "dnes" && <Today supabase={supabase} />}
      {tab === "trenirovki" && <Sessions supabase={supabase} />}
      {tab === "minali" && <Sessions supabase={supabase} past />}
      {tab === "klientki" && <Clients supabase={supabase} />}
      {tab === "grafik" && <Slots supabase={supabase} />}
    </div>
  );
}

type Db = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

/**
 * „Днес“: the trainings of today (or of the next training day), each with who booked, a big
 * „Дошла“ toggle per client, the cash to collect and „+ На вратата“.
 */
async function Today({ supabase }: { supabase: Db }) {
  await ensureStudioSessions(createAdminSupabaseClient());
  const today = utcToZoned(new Date().toISOString()).date;
  const date = await boardDate(supabase, today);
  const board = await listDayBoard(supabase, date);
  if (board.length === 0) {
    return (
      <p className="text-ink-soft">
        Няма тренировки за следващия месец. Добави ги в{" "}
        <Link href="/admin/zala?tab=grafik" className="underline">
          График
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold">
        {date === today ? `Днес · ${dayLabel(date)}` : `Следваща тренировка · ${dayLabel(date)}`}
      </h2>
      {board.map(({ session, entries }) => {
        const cash = cashLine(entries);
        return (
          <section
            key={session.id}
            className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5"
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold">
                {utcToZoned(session.startsAt).time} · {session.title}
              </h3>
              {session.cancelled ? (
                <Chip>Отменена</Chip>
              ) : (
                <span className="font-semibold">{attendanceLine(entries)}</span>
              )}
            </header>
            {entries.length === 0 ? (
              <p className="text-ink-soft">Още няма записани.</p>
            ) : (
              <ul className="divide-y divide-line">
                {entries.map((e) => (
                  <li key={e.bookingId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{e.name || "Без име"}</p>
                      {e.phone && (
                        <a href={telHref(e.phone)} className="text-sm text-ink-soft underline">
                          {e.phone}
                        </a>
                      )}
                      <p className="mt-1">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-bold",
                            e.card ? "bg-sand text-ink" : "bg-powder-light text-rose-deep",
                          )}
                        >
                          {rosterLabel(e)}
                        </span>
                      </p>
                    </div>
                    {!session.cancelled && (
                      <AttendanceToggle bookingId={e.bookingId} attended={e.attended} />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {cash && !session.cancelled && (
              <p className="rounded-xl bg-powder-light p-3 text-sm font-semibold text-rose-deep">
                {cash}
              </p>
            )}
            {!session.cancelled && (
              <DoorAdd sessionId={session.id} hereIds={entries.map((e) => e.userId)} />
            )}
          </section>
        );
      })}
    </div>
  );
}

/** Coming trainings from the start of today (a started one stays reachable for walk-ins), or the last 14 days. */
async function Sessions({ supabase, past = false }: { supabase: Db; past?: boolean }) {
  await ensureStudioSessions(createAdminSupabaseClient());
  const now = new Date();
  const startOfToday = new Date(zonedToUtc(utcToZoned(now.toISOString()).date, "00:00"));
  const from = past ? new Date(startOfToday.getTime() - 14 * 86_400_000) : startOfToday;
  const all = await listStudioSchedule(supabase, now, from);
  const sessions = past
    ? all.filter((s) => Date.parse(s.startsAt) < startOfToday.getTime()).reverse()
    : all;
  if (past && sessions.length === 0) {
    return <p className="text-ink-soft">Няма тренировки през последните 14 дни.</p>;
  }
  if (sessions.length === 0) {
    return (
      <p className="text-ink-soft">
        Няма тренировки за следващия месец. Добави ги в{" "}
        <Link href="/admin/zala?tab=grafik" className="underline">
          График
        </Link>
        .
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-xl bg-white ring-1 ring-line">
      {sessions.map((s) => {
        const { date, time } = utcToZoned(s.startsAt);
        return (
          <li key={s.id}>
            <Link
              href={`/admin/zala/${s.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-sand"
            >
              <span>
                <span className="font-semibold">
                  {dayLabel(date)}, {time}
                </span>{" "}
                · {s.title}
              </span>
              {s.cancelled ? (
                <Chip>Отменена</Chip>
              ) : (
                <span
                  className={cn("text-sm", s.booked >= s.capacity && "font-semibold text-brick")}
                >
                  {s.booked}/{s.capacity}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const WARNING_LABEL = { low: "1 посещение", expiring: "изтича скоро" } as const;

async function Clients({ supabase }: { supabase: Db }) {
  const today = utcToZoned(new Date().toISOString()).date;
  const clients = await listStudioClients(supabase, today);
  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="mb-4 font-semibold">Нова клиентка</h2>
        <ActionForm action={addWalkInAction.bind(null, null)} submitLabel="Добави" resetOnSuccess>
          <WalkInFields />
        </ActionForm>
      </section>
      {clients.length === 0 ? (
        <p className="text-ink-soft">Още няма клиентки на място.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl bg-white ring-1 ring-line">
          {clients.map((c) => (
            <li key={c.userId}>
              <Link
                href={`/admin/zala/klientka/${c.userId}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-sand"
              >
                <span>
                  <span className="font-semibold">{c.name || "Без име"}</span>
                  {c.phone && <span className="text-ink-soft"> · {c.phone}</span>}
                </span>
                <span className="flex items-center gap-2 text-sm">
                  {c.card ? cardLine(c.card) : "Няма карта"}
                  {c.warning && <Chip>{WARNING_LABEL[c.warning]}</Chip>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const WEEKDAY = ["", "Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота", "Неделя"];

async function Slots({ supabase }: { supabase: Db }) {
  const [slots, address] = await Promise.all([
    listStudioSlots(supabase),
    getStudioAddress(supabase),
  ]);
  const today = utcToZoned(new Date().toISOString()).date;
  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="mb-4 font-semibold">Адрес на залата</h2>
        <ActionForm action={saveStudioAddressAction} submitLabel="Запази">
          <Field label="Адрес" hint="Показва се с карта най-долу на /zala. Празно = без карта.">
            <input
              name="address"
              maxLength={200}
              defaultValue={address}
              placeholder="гр. Плевен, ул. …, зала …"
              className={inputClass}
            />
          </Field>
        </ActionForm>
      </section>
      <p className="text-sm text-ink-soft">
        Седмичният график се повтаря. Промяна важи за бъдещите тренировки без записани; тези със
        записани остават както са.
      </p>
      {slots.map((s) => (
        <section key={s.id} className="rounded-xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-4 font-semibold">
            {WEEKDAY[s.weekday]}, {s.startTime} · {s.title} {!s.active && <Chip>Спряна</Chip>}
          </h2>
          {s.active && (
            <p className="-mt-2 mb-4 text-sm text-ink-soft">
              Следващи дати: {nextDates(s.weekday, today, 4).map(dayMonth).join(", ")}
            </p>
          )}
          <ActionForm action={saveSlotAction.bind(null, s.id)} submitLabel="Запази">
            <SlotFields slot={s} />
          </ActionForm>
        </section>
      ))}
      <section className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="mb-4 font-semibold">Нова тренировка в графика</h2>
        <ActionForm action={saveSlotAction.bind(null, null)} submitLabel="Добави" resetOnSuccess>
          <SlotFields slot={null} />
        </ActionForm>
      </section>
    </div>
  );
}

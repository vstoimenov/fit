import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ActionForm } from "@/components/admin/action-form";
import { AttendanceToggle } from "@/components/admin/studio/attendance-toggle";
import { WalkInFields } from "@/components/admin/studio/walkin-fields";
import { Chip } from "@/components/ui/chip";
import { Field, inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import { dayLabel, rosterLabel } from "@/lib/studio/format";
import { requireAdmin } from "@/server/admin/require-admin";
import { listSessionRoster } from "@/server/studio/admin";
import { listStudioClients } from "@/server/studio/cards";
import {
  addBookingAction,
  addWalkInAction,
  cancelSessionAction,
  removeBookingAction,
} from "../actions";

export const metadata = { title: "Тренировка на място" };

export default function RosterPage({ params }: { params: Promise<{ sessionId: string }> }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Roster params={params} />
    </Suspense>
  );
}

async function Roster({ params }: { params: Promise<{ sessionId: string }> }) {
  await connection();
  const { sessionId } = await params;
  if (!z.uuid().safeParse(sessionId).success) notFound();
  const { supabase } = await requireAdmin();
  const now = new Date();
  const today = utcToZoned(now.toISOString()).date;
  const [{ session, entries }, clients] = await Promise.all([
    listSessionRoster(supabase, sessionId).catch(() => notFound()),
    listStudioClients(supabase, today),
  ]);
  const { date, time } = utcToZoned(session.startsAt);
  const here = new Set(entries.map((e) => e.userId));
  const others = clients.filter((c) => !here.has(c.userId));
  const over = Date.parse(session.startsAt) + session.durationMin * 60_000 <= now.getTime();

  return (
    <div className="space-y-6">
      <Link href="/admin/zala" className="text-sm underline">
        ← Тренировки
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-extrabold">
          {dayLabel(date)}, {time} · {session.title}
        </h1>
        {session.cancelled ? (
          <Chip>Отменена</Chip>
        ) : (
          <Chip>
            {session.booked}/{session.capacity} места
          </Chip>
        )}
      </header>

      <section className="rounded-xl bg-white ring-1 ring-line">
        {entries.length === 0 ? (
          <p className="p-5 text-ink-soft">Още няма записани.</p>
        ) : (
          <ul className="divide-y divide-line">
            {entries.map((e) => (
              <li
                key={e.bookingId}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <Link
                    href={`/admin/zala/klientka/${e.userId}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {e.name || "Без име"}
                  </Link>
                  {e.phone && <span className="text-ink-soft"> · {e.phone}</span>}
                  <p className="text-sm text-ink-soft">{rosterLabel(e)}</p>
                </div>
                {!session.cancelled && (
                  <AttendanceToggle bookingId={e.bookingId} attended={e.attended} />
                )}
                {!session.cancelled && (
                  <ActionForm
                    action={removeBookingAction.bind(null, e.bookingId)}
                    submitLabel="Премахни"
                    submitVariant="secondary"
                    submitAriaLabel={`Премахни ${e.name}`}
                    successMessage="Премахната ✓"
                    confirmMessage={`Да премахна ли ${e.name || "клиентката"}? Посещението ѝ се връща.`}
                  >
                    {null}
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {!session.cancelled && !over && (
        <>
          <section className="rounded-xl bg-white p-5 ring-1 ring-line">
            <h2 className="mb-4 font-semibold">Добави клиентка</h2>
            {others.length > 0 && (
              <ActionForm action={addBookingAction.bind(null, session.id)} submitLabel="Добави">
                <Field label="Клиентка">
                  <select name="userId" required className={inputClass} defaultValue="">
                    <option value="" disabled>
                      Избери…
                    </option>
                    {others.map((c) => (
                      <option key={c.userId} value={c.userId}>
                        {c.name || "Без име"}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              </ActionForm>
            )}
            <h3 className="mt-6 mb-3 text-sm font-semibold">Нова клиентка</h3>
            <ActionForm
              action={addWalkInAction.bind(null, session.id)}
              submitLabel="Добави"
              resetOnSuccess
            >
              <WalkInFields />
            </ActionForm>
          </section>
          <section className="rounded-xl bg-white p-5 ring-1 ring-line">
            <h2 className="mb-2 font-semibold">Отмяна</h2>
            <p className="mb-4 text-sm text-ink-soft">
              Всички записани получават посещението си обратно и известие (ако са включили
              известия).
            </p>
            <ActionForm
              action={cancelSessionAction.bind(null, session.id)}
              submitLabel="Отмени тренировката"
              submitVariant="secondary"
              confirmMessage="Да отменя ли тренировката? Записаните получават посещенията си обратно."
            >
              {null}
            </ActionForm>
          </section>
        </>
      )}
    </div>
  );
}

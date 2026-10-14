import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ActionForm } from "@/components/admin/action-form";
import { LevelBadge } from "@/components/admin/level-badge";
import { Sparkline } from "@/components/progress/sparkline";
import { Field, inputClass } from "@/components/ui/field";
import { utcToZoned } from "@/lib/admin/time";
import {
  FEELING_LABEL,
  GOAL_LABEL,
  PROBLEM_LABEL,
  TIME_LABEL,
  type Goal,
  type Problem,
  type Time,
} from "@/lib/labels";
import { getClientDetail } from "@/server/admin/clients";
import { requireAdmin } from "@/server/admin/require-admin";
import { addNoteAction, grantAccessAction, revokeAccessAction } from "./actions";

export const metadata = { title: "Клиентка" };
const when = (iso: string | null | undefined) =>
  iso ? `${utcToZoned(iso).date} ${utcToZoned(iso).time}` : "—";
const NOTE_LABEL = {
  call: "Обаждане",
  message: "Съобщение",
  note: "Бележка",
  snooze: "Отложено",
} as const;

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Client params={params} />
    </Suspense>
  );
}

async function Client({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const parsed = z.uuid().safeParse(id);
  const c = parsed.success ? await getClientDetail(supabase, parsed.data) : null;
  if (!c) notFound();
  const p = c.profile;
  const weights = c.checkIns.map((x) => x.weight_kg).filter((w): w is number => w !== null);
  const manual = c.subscription?.provider === "manual";
  const paid = c.subscription !== null && !manual;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">{p.name || p.email}</h1>
        <LevelBadge level={p.level} />
        {p.phone && p.phone_call_consent ? (
          <a
            href={`tel:${p.phone}`}
            className="rounded-full bg-moss px-3 py-1 text-sm font-semibold text-white"
          >
            📞 {p.phone}
          </a>
        ) : (
          <span className="text-sm text-ink-soft">Без съгласие за обаждане</span>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2 rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
          <h2 className="font-semibold">Анкета</h2>
          <p>Цел: {p.goal ? GOAL_LABEL[p.goal as Goal] : "—"}</p>
          <p>
            Проблеми: {p.problems.map((x) => PROBLEM_LABEL[x as Problem] ?? x).join(", ") || "—"}
          </p>
          <p>
            Ръст {p.height_cm ?? "—"} см · тегло {p.weight_kg ?? "—"} кг · цел{" "}
            {p.target_weight_kg ?? "—"} кг
          </p>
          <p>Време: {p.time_per_session ? TIME_LABEL[p.time_per_session as Time] : "—"}</p>
          <p className="break-words text-ink-soft">
            Имейл {p.email} · регистрация {when(p.joined_at)} · последно {when(p.last_seen_at)}
          </p>
          <p className="text-ink-soft">
            Маркетинг: {p.marketing_consent ? "да" : "не"} · здравни данни:{" "}
            {p.health_data_consent_at ? when(p.health_data_consent_at) : "—"}
          </p>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
          <h2 className="font-semibold">Абонамент</h2>
          <p>
            {c.subscription ? `${c.subscription.provider} · ${c.subscription.status}` : "Няма"}
            {c.subscription?.current_period_end
              ? ` · до ${when(c.subscription.current_period_end)}`
              : ""}
          </p>
          {paid ? (
            <p className="text-ink-soft">Платен абонамент — ръчен достъп не може да се дава.</p>
          ) : (
            <ActionForm
              action={grantAccessAction.bind(null, p.id)}
              submitLabel="Дай достъп"
              successMessage="Достъпът е даден ✓"
              className="flex flex-wrap items-end gap-2"
            >
              <Field label="Ръчен достъп, дни">
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={30}
                  className={inputClass + " h-11 w-28"}
                />
              </Field>
            </ActionForm>
          )}
          {manual && c.subscription?.status !== "canceled" && (
            <ActionForm
              action={revokeAccessAction.bind(null, p.id)}
              submitLabel="Спри ръчния достъп"
              successMessage="Спрян ✓"
            >
              <span />
            </ActionForm>
          )}
        </section>
      </div>

      <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="font-semibold">Тегло</h2>
        <Sparkline points={weights} label="Тегло във времето" />
        <ul className="text-sm text-ink-soft">
          {c.checkIns
            .slice(-5)
            .reverse()
            .map((x) => (
              <li key={x.created_at}>
                {when(x.created_at)} · {x.weight_kg ?? "—"} кг · талия {x.waist_cm ?? "—"} · енергия{" "}
                {x.energy ?? "—"}/5{x.note ? ` · „${x.note}"` : ""}
              </li>
            ))}
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="font-semibold">Тренировки ({c.completions.length})</h2>
        <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
          {c.completions.map((x) => {
            const w = (Array.isArray(x.workouts) ? x.workouts[0] : x.workouts) as {
              title: string;
              duration_min: number;
            } | null;
            return (
              <li key={x.id}>
                {x.local_date} · {w?.title ?? "—"} · {w?.duration_min ?? "?"} мин
                {x.feeling ? ` · ${FEELING_LABEL[x.feeling]}` : ""}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="font-semibold">Бележки и контакти</h2>
        <ActionForm action={addNoteAction.bind(null, p.id)} submitLabel="Добави" resetOnSuccess>
          <div className="flex flex-wrap gap-2">
            <select
              name="kind"
              defaultValue="note"
              aria-label="Вид"
              className={inputClass + " h-11 max-w-[12rem]"}
            >
              <option value="note">Бележка</option>
              <option value="call">Обаждане</option>
            </select>
            <input
              name="body"
              placeholder="Какво се случи?"
              aria-label="Текст"
              maxLength={2000}
              className={inputClass + " h-11 min-w-0 flex-1"}
            />
          </div>
        </ActionForm>
        <ul className="space-y-2 text-sm">
          {c.notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-paper p-2">
              <span className="font-semibold">{NOTE_LABEL[n.kind]}</span> · {when(n.created_at)} ·{" "}
              {n.authorName}
              {n.body && <p className="whitespace-pre-line break-words">{n.body}</p>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ActionForm } from "@/components/admin/action-form";
import { GrantFields } from "@/components/admin/studio/grant-fields";
import { Chip } from "@/components/ui/chip";
import { Field, inputClass } from "@/components/ui/field";
import { formatDateBg, utcToZoned } from "@/lib/admin/time";
import { dayLabel } from "@/lib/studio/format";
import { cardLine, isPlaceholderEmail } from "@/lib/studio/rules";
import { requireAdmin } from "@/server/admin/require-admin";
import { loadMyStudio } from "@/server/studio/booking";
import { adjustCardAction, grantCardAction, inviteAction, voidCardAction } from "../../actions";

export const metadata = { title: "Клиентка на място" };

export default function StudioClientPage({ params }: { params: Promise<{ userId: string }> }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <StudioClient params={params} />
    </Suspense>
  );
}

async function StudioClient({ params }: { params: Promise<{ userId: string }> }) {
  await connection();
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) notFound();
  const { supabase } = await requireAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, phone, email")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) notFound();
  const now = new Date();
  const today = utcToZoned(now.toISOString()).date;
  const my = await loadMyStudio(supabase, userId, now);
  const hasLogin = !isPlaceholderEmail(profile.email);
  const cards = [...my.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-6">
      <Link href="/admin/zala?tab=klientki" className="text-sm underline">
        ← Клиентки
      </Link>
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-extrabold">{profile.name || "Без име"}</h1>
        <p className="text-ink-soft">
          {profile.phone ?? "без телефон"} · {hasLogin ? profile.email : "без профил за вход"}
        </p>
      </header>

      <section className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="mb-4 font-semibold">Дай карта</h2>
        <ActionForm
          action={grantCardAction.bind(null, userId)}
          submitLabel="Дай картата"
          resetOnSuccess
        >
          <GrantFields today={today} />
        </ActionForm>
      </section>

      {cards.map((c) => (
        <section key={c.id} className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-line">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{cardLine(c)}</h2>
            {c.voided && <Chip>Анулирана</Chip>}
            {!c.voided && c.endsOn < today && <Chip>Изтекла</Chip>}
          </div>
          <p className="text-sm text-ink-soft">
            От {formatDateBg(c.startsOn)} до {formatDateBg(c.endsOn)} · пренесени от тефтера:{" "}
            {c.usedBefore} · записвания: {c.booked} · корекции: {c.adjusted >= 0 ? "+" : ""}
            {c.adjusted}
          </p>
          {my.adjustments
            .filter((a) => a.cardId === c.id)
            .map((a) => (
              <p key={a.createdAt + a.reason} className="text-sm">
                {a.delta > 0 ? `+${a.delta}` : `−${-a.delta}`}: {a.reason}
              </p>
            ))}
          {!c.voided && (
            <div className="flex flex-wrap items-end gap-6">
              <ActionForm
                action={adjustCardAction.bind(null, c.id)}
                submitLabel="Коригирай"
                resetOnSuccess
                className="flex flex-wrap items-end gap-3"
              >
                <Field label="± посещения">
                  <input name="delta" type="number" required className={`${inputClass} w-28`} />
                </Field>
                <Field label="Причина">
                  <input
                    name="reason"
                    required
                    minLength={2}
                    maxLength={200}
                    className={inputClass}
                  />
                </Field>
              </ActionForm>
              {c.booked === 0 && (
                <ActionForm
                  action={voidCardAction.bind(null, c.id)}
                  submitLabel="Анулирай"
                  submitVariant="secondary"
                  confirmMessage="Да анулирам ли картата? Използвай го само ако е дадена по грешка."
                >
                  {null}
                </ActionForm>
              )}
            </div>
          )}
        </section>
      ))}

      {!hasLogin && (
        <section className="rounded-xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-2 font-semibold">Покана</h2>
          <p className="mb-4 text-sm text-ink-soft">
            Линк, с който тя си прави имейл и парола и вижда картата си. Изпрати ѝ го по Viber или
            WhatsApp. Важи 14 дни, еднократно.
          </p>
          <ActionForm
            action={inviteAction.bind(null, userId)}
            submitLabel="Създай линк"
            successMessage=""
          >
            {null}
          </ActionForm>
        </section>
      )}

      <section className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="mb-3 font-semibold">Записвания</h2>
        {my.upcoming.length + my.past.length === 0 ? (
          <p className="text-sm text-ink-soft">Няма.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {[...my.upcoming, ...my.past].map((b) => {
              const { date, time } = utcToZoned(b.startsAt);
              return (
                <li key={b.id}>
                  {dayLabel(date)}, {time} · {b.title} · {b.cardId ? "по карта" : "7 € на място"}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

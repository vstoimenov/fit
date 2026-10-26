import { connection } from "next/server";
import { Suspense } from "react";
import { serverEnv } from "@/env";
import { utcToZoned } from "@/lib/admin/time";
import { requireAdmin } from "@/server/admin/require-admin";
import { countSubscribedMembers, listPushSends } from "@/server/push/broadcast";
import { BroadcastForm } from "./form";

export const metadata = { title: "Известия" };

const KIND_LABEL: Record<string, string> = {
  broadcast: "Съобщение",
  workout: "Нова тренировка",
  reminder: "Напомняне",
};

export default function NotificationsPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Notifications />
    </Suspense>
  );
}

async function Notifications() {
  await connection();
  const { supabase } = await requireAdmin();
  const [subscribed, sends] = await Promise.all([
    countSubscribedMembers(supabase),
    listPushSends(supabase),
  ]);
  const configured = Boolean(
    serverEnv.WEB_PUSH_PUBLIC_KEY && serverEnv.WEB_PUSH_PRIVATE_KEY && serverEnv.WEB_PUSH_SUBJECT,
  );
  const cronReady = Boolean(serverEnv.CRON_SECRET);
  const lastAutomatic = sends.find((s) => s.kind !== "broadcast")?.created_at ?? null;
  const lastText = lastAutomatic
    ? ` (последно: ${utcToZoned(lastAutomatic).date} ${utcToZoned(lastAutomatic).time})`
    : " (още нищо не е пращано автоматично)";
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Известия</h1>
      <p className="text-sm text-ink-soft">
        {subscribed} {subscribed === 1 ? "клиентка е включила" : "клиентки са включили"} известията.
        {cronReady
          ? ` Напомнянията и „Нова тренировка“ тръгват автоматично всеки час${lastText}.`
          : " Автоматичните известия не са включени: липсва CRON_SECRET (виж README)."}
      </p>
      {!configured && (
        <p className="rounded-xl bg-powder-light p-4 text-sm text-rose-deep">
          Известията не са настроени: липсват WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY /
          WEB_PUSH_SUBJECT (виж README).
        </p>
      )}
      {configured && (
        <section className="rounded-xl bg-white p-5 ring-1 ring-line">
          <h2 className="mb-4 font-semibold">Съобщение до всички</h2>
          <BroadcastForm />
        </section>
      )}
      <section className="space-y-3">
        <h2 className="font-semibold">Последни изпращания</h2>
        {sends.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-ink-soft ring-1 ring-line">
            Още нищо не е пращано.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-ink-soft uppercase">
                <tr>
                  <th className="px-3 py-2">Кога</th>
                  <th className="px-3 py-2">Вид</th>
                  <th className="px-3 py-2">Заглавие</th>
                  <th className="px-3 py-2">Текст</th>
                  <th className="px-3 py-2">Получили</th>
                </tr>
              </thead>
              <tbody>
                {sends.map((s) => {
                  const at = utcToZoned(s.created_at);
                  return (
                    <tr key={s.id} className="border-t border-line">
                      <td className="px-3 py-2 text-ink-soft tabular-nums">
                        {at.date} {at.time}
                      </td>
                      <td className="px-3 py-2">{KIND_LABEL[s.kind] ?? s.kind}</td>
                      <td className="px-3 py-2 font-semibold">{s.title}</td>
                      <td className="px-3 py-2 text-ink-soft">{s.body}</td>
                      <td className="px-3 py-2 tabular-nums">{s.recipients}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

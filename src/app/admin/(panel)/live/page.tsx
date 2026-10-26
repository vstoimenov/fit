import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Chip } from "@/components/ui/chip";
import { utcToZoned } from "@/lib/admin/time";
import { requireAdmin } from "@/server/admin/require-admin";
import { listLiveSessions } from "@/server/live/admin";
import { LiveForm } from "./live-form";

export const metadata = { title: "На живо" };

export default function LivePage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Live />
    </Suspense>
  );
}

async function Live() {
  await connection();
  const { supabase } = await requireAdmin();
  const sessions = await listLiveSessions(supabase);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">На живо</h1>
      <section className="rounded-xl bg-white p-5 ring-1 ring-line">
        <h2 className="mb-4 font-semibold">Нова сесия</h2>
        <LiveForm session={null} />
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Всички сесии ({sessions.length})</h2>
        {sessions.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-ink-soft ring-1 ring-line">
            Още няма сесии.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-ink-soft uppercase">
                <tr>
                  <th className="px-3 py-2">Кога</th>
                  <th className="px-3 py-2">Заглавие</th>
                  <th className="px-3 py-2">Мин</th>
                  <th className="px-3 py-2">Състояние</th>
                  <th className="px-3 py-2">Влезли</th>
                  <th className="px-3 py-2">Запис</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const at = utcToZoned(s.startsAt);
                  return (
                    <tr key={s.id} className="border-t border-line">
                      <td className="px-3 py-2 text-ink-soft tabular-nums">
                        {at.date} {at.time}
                      </td>
                      <td className="px-3 py-2 font-semibold">
                        <Link href={`/admin/live/${s.id}`} className="underline underline-offset-2">
                          {s.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{s.durationMin}</td>
                      <td className="px-3 py-2">
                        <Chip tone={s.published ? "ink" : "neutral"}>
                          {s.published ? (s.past ? "минала" : "публикувана") : "чернова"}
                        </Chip>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{s.attendees}</td>
                      <td className="px-3 py-2">{s.recordingUrl ? "да" : "—"}</td>
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

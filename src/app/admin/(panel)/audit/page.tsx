import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonClass } from "@/components/ui/button";
import { utcToZoned } from "@/lib/admin/time";
import { listAudit } from "@/server/admin/audit";
import { requireAdmin } from "@/server/admin/require-admin";

export const metadata = { title: "Одит" };

const PAGE = 100;
const TYPE: Record<string, string> = {
  workouts: "Тренировка",
  workout_media: "Видео линк",
  plans: "План",
  subscriptions: "Абонамент",
  settings: "Настройка",
  profiles: "Роля",
};
const ACTION: Record<string, string> = { insert: "създаде", update: "промени", delete: "изтри" };

type Search = Promise<{ before?: string | string[] }>;

export default function AuditPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}

async function Audit({ searchParams }: { searchParams: Search }) {
  await connection();
  const { before } = await searchParams;
  const beforeId =
    typeof before === "string" && /^\d{1,15}$/.test(before) ? Number(before) : undefined;
  const { supabase } = await requireAdmin();
  const entries = await listAudit(supabase, { beforeId, limit: PAGE });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Одит</h1>
      <ul className="space-y-2 text-sm">
        {entries.map((e) => {
          const at = utcToZoned(e.createdAt);
          return (
            <li key={e.id} className="rounded-xl bg-white p-3 ring-1 ring-line">
              <p className="break-words">
                <span className="tabular-nums text-ink-soft">
                  {at.date} {at.time}
                </span>{" "}
                · <strong>{e.actorName}</strong> {ACTION[e.action] ?? e.action}{" "}
                {TYPE[e.targetType] ?? e.targetType}{" "}
                <span className="break-all text-ink-soft">{e.targetId}</span>
              </p>
              <details>
                <summary className="cursor-pointer py-1 text-ink-soft">Детайли</summary>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all text-xs">
                  {JSON.stringify(e.diff, null, 2)}
                </pre>
              </details>
            </li>
          );
        })}
      </ul>
      {entries.length === 0 && <p className="text-ink-soft">Няма записи.</p>}
      {entries.length === PAGE && (
        <Link
          href={`/admin/audit?before=${entries.at(-1)!.id}`}
          className={buttonClass("quiet", "md")}
        >
          По-стари →
        </Link>
      )}
    </div>
  );
}

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { utcToZoned } from "@/lib/admin/time";
import { requireAdmin } from "@/server/admin/require-admin";
import { listReports } from "@/server/community/admin";
import { listFeed } from "@/server/community/feed";
import { PostActions, ReportActions } from "./report-actions";

export const metadata = { title: "Общност" };

export default function CommunityAdminPage() {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <CommunityAdmin />
    </Suspense>
  );
}

async function CommunityAdmin() {
  await connection();
  const { supabase } = await requireAdmin();
  const [reports, feed] = await Promise.all([listReports(supabase), listFeed(supabase, null, 20)]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold">Общност</h1>
      <section className="space-y-3">
        <h2 className="font-semibold">Сигнали ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-ink-soft ring-1 ring-line">
            Няма отворени сигнали.
          </p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => {
              const at = utcToZoned(r.created_at);
              return (
                <li key={r.id} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-line">
                  <p className="text-xs text-ink-soft">
                    {at.date} {at.time} · от {r.reporter} · {r.post_id ? "публикация" : "коментар"}
                    {r.hidden ? " · скрито" : ""}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Причина:</span> {r.reason}
                  </p>
                  <blockquote className="rounded-lg bg-sand p-3 text-sm whitespace-pre-wrap">
                    <span className="font-semibold">{r.author ?? "—"}:</span>{" "}
                    {r.body ?? "(изтрито)"}
                  </blockquote>
                  {r.context_post_id && (
                    <Link
                      href={`/app/community/${r.context_post_id}`}
                      className="text-sm underline underline-offset-2"
                    >
                      Отвори в приложението
                    </Link>
                  )}
                  <ReportActions report={r} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Последни публикации</h2>
        {feed.posts.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-ink-soft ring-1 ring-line">
            Още няма публикации.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-line">
            <table className="w-full text-left text-sm">
              <thead className="text-xs tracking-wide text-ink-soft uppercase">
                <tr>
                  <th className="px-3 py-2">Кога</th>
                  <th className="px-3 py-2">Авторка</th>
                  <th className="px-3 py-2">Текст</th>
                  <th className="px-3 py-2">♥ / коментари</th>
                  <th className="px-3 py-2">Състояние</th>
                  <th className="px-3 py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {feed.posts.map((p) => {
                  const at = utcToZoned(p.createdAt);
                  return (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-3 py-2 text-ink-soft tabular-nums">
                        {at.date} {at.time}
                      </td>
                      <td className="px-3 py-2 font-semibold">{p.authorName}</td>
                      <td className="max-w-md px-3 py-2">
                        <Link
                          href={`/app/community/${p.id}`}
                          className="line-clamp-2 underline-offset-2 hover:underline"
                        >
                          {p.body}
                        </Link>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {p.hearts} / {p.comments}
                      </td>
                      <td className="px-3 py-2">{p.hidden ? "скрита" : "видима"}</td>
                      <td className="px-3 py-2">
                        <PostActions id={p.id} hidden={p.hidden} />
                      </td>
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

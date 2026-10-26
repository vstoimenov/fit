import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { requireAdmin } from "@/server/admin/require-admin";
import { getAdminLiveSession } from "@/server/live/admin";
import { LiveForm } from "../live-form";

export const metadata = { title: "Сесия на живо" };

export default function EditLivePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p aria-busy="true">Зареждане…</p>}>
      <EditLive params={params} />
    </Suspense>
  );
}

async function EditLive({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await requireAdmin();
  const session = await getAdminLiveSession(supabase, id);
  if (!session) notFound();
  return (
    <div className="space-y-6">
      <Link
        href="/admin/live"
        className="text-sm font-semibold text-ink-soft underline underline-offset-2"
      >
        ← Всички сесии
      </Link>
      <h1 className="font-display text-2xl font-extrabold">{session.title}</h1>
      <p className="text-sm text-ink-soft">{session.attendees} влезли</p>
      <section className="rounded-xl bg-white p-5 ring-1 ring-line">
        <LiveForm session={session} />
      </section>
    </div>
  );
}

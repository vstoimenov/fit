import { z } from "zod";
import { AppError } from "@/lib/app-error";
import type { Level } from "@/lib/program/types";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedClient } from "@/server/db/types";

type StatsRow = Database["public"]["Functions"]["admin_client_stats"]["Returns"][number];

export interface ClientRow {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  phoneCallConsent: boolean;
  level: Level;
  joinedAt: string;
  lastSeenAt: string | null;
  onboardingDone: boolean;
  subStatus: string | null;
  subProvider: string | null;
  currentPeriodEnd: string | null;
  hasAccess: boolean;
  totalDone: number;
  lastDoneAt: string | null;
  done7: number;
  done30: number;
  minutes7: number;
  minutes30: number;
  published14: number;
  doneRegular14: number;
  paidWithoutWorkout: boolean;
  snoozedUntil: string | null;
}

export function toClientRow(r: StatsRow): ClientRow {
  return {
    userId: r.user_id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? null,
    phoneCallConsent: r.phone_call_consent,
    level: r.level,
    joinedAt: r.joined_at,
    lastSeenAt: r.last_seen_at ?? null,
    onboardingDone: r.onboarding_done,
    subStatus: r.sub_status ?? null,
    subProvider: r.sub_provider ?? null,
    currentPeriodEnd: r.current_period_end ?? null,
    hasAccess: r.has_access,
    totalDone: r.total_done,
    lastDoneAt: r.last_done_at ?? null,
    done7: r.done_7,
    done30: r.done_30,
    minutes7: r.minutes_7,
    minutes30: r.minutes_30,
    published14: r.published_14,
    doneRegular14: r.done_regular_14,
    paidWithoutWorkout: r.paid_without_workout,
    snoozedUntil: r.snoozed_until ?? null,
  };
}

export async function listClients(
  db: TypedClient,
  opts: { search?: string; limit?: number; offset?: number } = {},
): Promise<{ rows: ClientRow[]; total: number }> {
  const { data, error } = await db.rpc("admin_client_stats", {
    p_search: opts.search?.trim() || undefined,
    p_limit: opts.limit ?? 200,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw new Error(`list clients failed: ${error.message}`);
  return { rows: data.map(toClientRow), total: Number(data[0]?.total_count ?? 0) };
}

const COMPLETIONS_SHOWN = 60;

export async function getClientDetail(db: TypedClient, userId: string) {
  const [profile, subscription, completions, completionsCount, checkIns, notes] = await Promise.all(
    [
      db
        .from("profiles")
        .select(
          "id, name, email, phone, phone_call_consent, marketing_consent, health_data_consent_at, level, goal, problems, height_cm, weight_kg, target_weight_kg, time_per_session, joined_at, last_seen_at, timezone, starter_week_done_at, role",
        )
        .eq("id", userId)
        .maybeSingle(),
      db
        .from("subscriptions")
        .select("status, provider, current_period_end, grace_until, canceled_at")
        .eq("user_id", userId)
        .maybeSingle(),
      db
        .from("workout_completions")
        .select("id, completed_at, local_date, feeling, workouts(title, kind, level, duration_min)")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(COMPLETIONS_SHOWN),
      db
        .from("workout_completions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      db
        .from("check_ins")
        .select("created_at, weight_kg, waist_cm, hips_cm, energy, mood, note")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("client_notes")
        .select(
          "id, kind, body, snooze_until, created_at, author:profiles!client_notes_author_id_fkey(name)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ],
  );
  const failed = [profile, subscription, completions, completionsCount, checkIns, notes].find(
    (r) => r.error,
  );
  if (failed?.error) throw new Error(`load client failed: ${failed.error.message}`);
  if (!profile.data || profile.data.role !== "client") return null;
  return {
    profile: profile.data,
    subscription: subscription.data,
    completions: completions.data ?? [],
    completionsTotal: completionsCount.count ?? 0,
    checkIns: [...(checkIns.data ?? [])].reverse(),
    notes: (notes.data ?? []).map((n) => {
      const author = n.author as { name: string } | { name: string }[] | null;
      return { ...n, authorName: (Array.isArray(author) ? author[0]?.name : author?.name) ?? "—" };
    }),
  };
}
export type ClientDetail = NonNullable<Awaited<ReturnType<typeof getClientDetail>>>;

const daysSchema = z.number().int().min(1, "Поне 1 ден").max(365, "До 365 дни");

export async function grantManualAccess(
  db: TypedClient,
  userId: string,
  days: number,
): Promise<void> {
  const d = daysSchema.parse(days);
  const { data: existing, error: loadError } = await db
    .from("subscriptions")
    .select("provider")
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) throw new Error(`load subscription failed: ${loadError.message}`);
  if (existing && existing.provider !== "manual")
    throw new AppError("CONFLICT", "Клиентката има платен абонамент.");
  const { error } = await db.from("subscriptions").upsert(
    {
      user_id: userId,
      provider: "manual",
      status: "active",
      current_period_end: new Date(Date.now() + d * 86_400_000).toISOString(),
      grace_until: null,
      canceled_at: null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`grant access failed: ${error.message}`);
}

export async function revokeManualAccess(db: TypedClient, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("subscriptions")
    .update({ status: "canceled", current_period_end: now, canceled_at: now })
    .eq("user_id", userId)
    .eq("provider", "manual")
    .select("user_id");
  if (error) throw new Error(`revoke access failed: ${error.message}`);
  if (data.length === 0) throw new AppError("NOT_FOUND", "Няма ръчен достъп за спиране.");
}

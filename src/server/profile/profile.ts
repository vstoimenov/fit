import { AppError } from "@/lib/app-error";
import { profileAnswersSchema } from "@/lib/onboarding/schema";
import type { CheckInInput } from "@/lib/progress/check-in-schema";
import type { Level } from "@/lib/program/types";
import { paidSubOpen } from "@/lib/subscription-text";
import type { TypedClient } from "@/server/db/types";
import { listProgressPhotos, removeAllProgressPhotos } from "@/server/progress/photos";

export async function updateProfileBasics(
  db: TypedClient,
  userId: string,
  input: { name: string; level: Level },
): Promise<void> {
  const { error } = await db
    .from("profiles")
    .update({ name: input.name, level: input.level })
    .eq("id", userId);
  if (error) throw new Error(`update profile failed: ${error.message}`);
}

/**
 * Lets a member correct her questionnaire answers and withdraw or give the phone/marketing consents.
 * Same validation as onboarding; unknown keys (role, level, ...) are dropped by the schema, and the
 * column grants keep privileged fields out of reach regardless. Throws ZodError on invalid input.
 */
export async function updateProfileAnswers(
  db: TypedClient,
  userId: string,
  raw: unknown,
): Promise<void> {
  const a = profileAnswersSchema.parse(raw);
  const { error } = await db
    .from("profiles")
    .update({
      goal: a.goal,
      problems: a.problems,
      height_cm: a.heightCm,
      weight_kg: a.weightKg,
      target_weight_kg: a.targetWeightKg,
      phone: a.phone === "" ? null : a.phone,
      phone_call_consent: a.phoneCallConsent,
      marketing_consent: a.marketingConsent,
    })
    .eq("id", userId);
  if (error) throw new Error(`update profile answers failed: ${error.message}`);
}

export async function addCheckIn(db: TypedClient, input: CheckInInput): Promise<void> {
  const { error } = await db.from("check_ins").insert(input);
  if (error) throw new Error(`check-in failed: ${error.message}`);
}

/**
 * Everything stored about the signed-in user (GDPR access right). Own rows are read through the
 * user's RLS-scoped client; `visits` and `client_notes` are admin-only under RLS, so those use `admin`.
 * Notes are exported without the author's id, only what was recorded and when.
 */
export async function exportMyData(
  db: TypedClient,
  userId: string,
  admin: TypedClient,
): Promise<Record<string, unknown>> {
  const [profile, completions, checkIns, subscription, visits, notes, ledger, rewards, photos] =
    await Promise.all([
      db.from("profiles").select("*").eq("id", userId).single(),
      db
        .from("workout_completions")
        .select("workout_id, completed_at, local_date, feeling")
        .eq("user_id", userId),
      db
        .from("check_ins")
        .select("created_at, weight_kg, waist_cm, hips_cm, energy, mood, note")
        .eq("user_id", userId),
      db
        .from("subscriptions")
        .select("status, current_period_end, provider")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("visits")
        .select("path, referrer, utm, device, created_at")
        .eq("user_id", userId)
        .order("created_at"),
      admin
        .from("client_notes")
        .select("kind, body, created_at")
        .eq("user_id", userId)
        .order("created_at"),
      db
        .from("points_ledger")
        .select("source, ref, points, reason, created_at")
        .eq("user_id", userId)
        .order("created_at"),
      db.from("rewards_given").select("level, given_at, note").eq("user_id", userId).order("level"),
      // Signed with her own client; each link works for an hour.
      listProgressPhotos(db).then(
        (data) => ({ data, error: null }),
        (e: unknown) => ({ data: null, error: e instanceof Error ? e : new Error(String(e)) }),
      ),
    ]);
  // A silently partial export would misstate what is stored about the user.
  const failed = [
    profile,
    completions,
    checkIns,
    subscription,
    visits,
    notes,
    ledger,
    rewards,
    photos,
  ].find((r) => r.error);
  if (failed?.error) throw new Error(`export failed: ${failed.error.message}`);
  return {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    workout_completions: completions.data ?? [],
    check_ins: checkIns.data ?? [],
    subscription: subscription.data,
    visits: visits.data ?? [],
    client_notes: notes.data ?? [],
    points_ledger: ledger.data ?? [],
    rewards_given: rewards.data ?? [],
    progress_photos: (photos.data ?? []).map((p) => ({
      taken_on: p.takenOn,
      created_at: p.createdAt,
      url: p.url,
      url_expires_in_seconds: 3600,
    })),
  };
}

const PAGE = 1000;
const IN_CHUNK = 100;

/** Every anon_id that was ever seen together with this user_id. */
async function anonIdsOf(admin: TypedClient, userId: string): Promise<string[]> {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("visits")
      .select("anon_id")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`load visits failed: ${error.message}`);
    for (const row of data) ids.add(row.anon_id);
    if (data.length < PAGE) return [...ids];
  }
}

/**
 * Removes the auth user; profile and all owned rows cascade. Needs the service-role client.
 * visits.user_id is `on delete set null` and rows keep a persistent anon_id, so the visits that
 * identify the user (by user_id or by a shared anon_id) are deleted first.
 * A live paid subscription is cancelled first via `cancelPaid`; if that fails nothing is deleted.
 * Her progress-photo objects are removed from Storage next; if that fails nothing else is deleted.
 */
export async function deleteAccount(
  admin: TypedClient,
  userId: string,
  cancelPaid: (sub: { provider: string; subscriptionId: string }) => Promise<void>,
): Promise<void> {
  // Any card subscription not already ended must be stopped before the row that links it to her
  // disappears, otherwise she keeps being charged for an account that no longer exists. Gated on
  // the stored status, not on access: a past_due sub beyond our grace is still on Stripe's retry
  // schedule. cancelNow is idempotent, so a subscription already dead at the provider is fine.
  const { data: sub, error: subError } = await admin
    .from("subscriptions")
    .select("provider, provider_sub_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (subError) throw new Error(`load subscription failed: ${subError.message}`);
  if (sub && paidSubOpen(sub) && sub.provider_sub_id) {
    try {
      await cancelPaid({ provider: sub.provider, subscriptionId: sub.provider_sub_id });
    } catch (error) {
      console.error(
        "cancel before delete failed",
        userId,
        error instanceof Error ? error.message : "unknown",
      );
      throw new AppError(
        "CONFLICT",
        "Не успяхме да спрем абонамента. Профилът не е изтрит — опитай пак или ни пиши.",
      );
    }
  }

  // Her photos live in Storage, which no cascade reaches. They go before anything irreversible; if
  // removal fails the account stays, so a retry can finish the job.
  await removeAllProgressPhotos(admin, userId);

  const anonIds = await anonIdsOf(admin, userId);
  for (let i = 0; i < anonIds.length; i += IN_CHUNK) {
    const { error } = await admin
      .from("visits")
      .delete()
      .in("anon_id", anonIds.slice(i, i + IN_CHUNK));
    if (error) throw new Error(`delete visits failed: ${error.message}`);
  }
  const { error: ownError } = await admin.from("visits").delete().eq("user_id", userId);
  if (ownError) throw new Error(`delete visits failed: ${ownError.message}`);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete account failed: ${error.message}`);
}

import type { CheckInInput } from "@/lib/progress/check-in-schema";
import type { Level } from "@/lib/program/types";
import type { TypedClient } from "@/server/db/types";

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

export async function addCheckIn(db: TypedClient, input: CheckInInput): Promise<void> {
  const { error } = await db.from("check_ins").insert(input);
  if (error) throw new Error(`check-in failed: ${error.message}`);
}

/** Everything stored about the signed-in user (GDPR access right). */
export async function exportMyData(
  db: TypedClient,
  userId: string,
): Promise<Record<string, unknown>> {
  const [profile, completions, checkIns, subscription] = await Promise.all([
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
  ]);
  // A silently partial export would misstate what is stored about the user.
  const failed = [profile, completions, checkIns, subscription].find((r) => r.error);
  if (failed?.error) throw new Error(`export failed: ${failed.error.message}`);
  return {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    workout_completions: completions.data ?? [],
    check_ins: checkIns.data ?? [],
    subscription: subscription.data,
  };
}

/** Removes the auth user; profile and all owned rows cascade. Needs the service-role client. */
export async function deleteAccount(admin: TypedClient, userId: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`delete account failed: ${error.message}`);
}

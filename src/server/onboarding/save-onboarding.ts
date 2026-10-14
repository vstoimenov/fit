import { AppError } from "@/lib/app-error";
import { levelFromExperience, onboardingSchema } from "@/lib/onboarding/schema";
import type { TypedClient } from "@/server/db/types";

/** Validates the questionnaire and writes it to the user's profile. Throws ZodError/AppError. */
export async function saveOnboarding(
  db: TypedClient,
  userId: string,
  raw: unknown,
): Promise<{ freeWorkoutId: string }> {
  const a = onboardingSchema.parse(raw);
  // Look up the free workout first so a missing seed never leaves a half-written profile.
  const { data: free, error: freeError } = await db
    .from("workouts")
    .select("id")
    .eq("kind", "free")
    .maybeSingle();
  if (freeError || !free)
    throw new AppError("NOT_FOUND", "Безплатната тренировка още не е качена.");

  // Replay (retry, second tab, stale draft): keep the first answers and the original consent time.
  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("onboarding_done")
    .eq("id", userId)
    .single();
  if (profileError) throw new AppError("INVALID", "Не успяхме да запазим отговорите. Опитай пак.");
  if (profile.onboarding_done) return { freeWorkoutId: free.id };

  const { error } = await db
    .from("profiles")
    .update({
      name: a.name,
      goal: a.goal,
      problems: a.problems,
      level: levelFromExperience(a.experience),
      height_cm: a.heightCm,
      weight_kg: a.weightKg,
      target_weight_kg: a.targetWeightKg,
      time_per_session: a.time,
      phone: a.phone === "" ? null : a.phone,
      phone_call_consent: a.phoneCallConsent,
      marketing_consent: a.marketingConsent,
      health_data_consent_at: new Date().toISOString(),
      onboarding_done: true,
    })
    .eq("id", userId)
    .eq("onboarding_done", false) // a concurrent request that finished first wins
    .select("id")
    .maybeSingle();
  if (error) throw new AppError("INVALID", "Не успяхме да запазим отговорите. Опитай пак.");
  // No error and no row means another request completed onboarding between our read and write: same outcome.
  return { freeWorkoutId: free.id };
}

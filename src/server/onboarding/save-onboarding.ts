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
    .eq("id", userId);
  if (error) throw new AppError("INVALID", "Не успяхме да запазим отговорите. Опитай пак.");

  const { data: free, error: freeError } = await db
    .from("workouts")
    .select("id")
    .eq("kind", "free")
    .maybeSingle();
  if (freeError || !free)
    throw new AppError("NOT_FOUND", "Безплатната тренировка още не е качена.");
  return { freeWorkoutId: free.id };
}

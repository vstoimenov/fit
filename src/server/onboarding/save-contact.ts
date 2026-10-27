import { AppError } from "@/lib/app-error";
import { contactStepSchema } from "@/lib/onboarding/schema";
import type { TypedClient } from "@/server/db/types";

/**
 * Stores the phone and call consent from the sign-up screen on her own profile, so the coach has a
 * way to reach her even if she leaves before the questions. Throws ZodError/AppError.
 */
export async function saveContact(db: TypedClient, userId: string, raw: unknown): Promise<void> {
  const contact = contactStepSchema.parse(raw);
  const { error } = await db
    .from("profiles")
    .update({ phone: contact.phone, phone_call_consent: contact.phoneCallConsent })
    .eq("id", userId);
  if (error) throw new AppError("INVALID", "Не успяхме да запазим телефона. Опитай пак.");
}

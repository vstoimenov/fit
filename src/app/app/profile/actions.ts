"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { parsePasswordChange } from "@/lib/auth/password-change";
import { profileFormToAnswers } from "@/lib/onboarding/profile-form";
import { requireUser } from "@/server/auth/require-user";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { createServerSupabaseClient } from "@/server/db/server";
import { openPortal } from "@/server/payments/checkout";
import { ProviderUnavailableError } from "@/server/payments/provider";
import { createStripeProvider } from "@/server/payments/stripe-provider";
import { deleteAccount, updateProfileAnswers, updateProfileBasics } from "@/server/profile/profile";

const basicsSchema = z.object({
  name: z.string().trim().min(1, "Името е задължително").max(60),
  level: z.enum(["beginner", "advanced", "pro"]),
});

export async function saveProfile(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    await updateProfileBasics(supabase, user.id, basicsSchema.parse(Object.fromEntries(form)));
    revalidatePath("/app", "layout");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

/** Questionnaire answers, phone and the phone/marketing consents (withdrawal included). */
export async function saveAnswers(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { user, supabase } = await requireUser();
    await updateProfileAnswers(supabase, user.id, profileFormToAnswers(form));
    revalidatePath("/app", "layout");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

/** „Смени паролата“ in Профил: the session client updates its own user; no e-mail round trip. */
export async function changePassword(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    const parsed = parsePasswordChange(form);
    if (!parsed.ok) throw new AppError("INVALID", parsed.message);
    const { error } = await supabase.auth.updateUser({ password: parsed.password });
    if (error) {
      // Supabase refuses the previous password and leaked ones with a 422; say so in her words.
      if (error.status === 422) {
        throw new AppError("INVALID", "Тази парола не може да се ползва. Избери друга.");
      }
      throw new Error(`change password failed: ${error.message}`);
    }
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function signOut(): Promise<void> {
  // No requireUser(): an already-expired session should still end up on the landing page.
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteMyAccount(_prev: unknown, form: FormData): Promise<ActionResult<null>> {
  try {
    if (form.get("confirm") !== "ИЗТРИЙ") {
      throw new AppError("INVALID", "Напиши ИЗТРИЙ, за да потвърдиш.");
    }
    const { user, supabase } = await requireUser();
    await deleteAccount(
      createAdminSupabaseClient(),
      user.id,
      async ({ provider, subscriptionId }) => {
        if (provider !== "stripe") throw new Error("unsupported provider");
        // Without Stripe keys this throws ProviderUnavailableError, which refuses the deletion:
        // we must not leave a paying card behind.
        await createStripeProvider({
          secretKey: serverEnv.STRIPE_SECRET_KEY,
          webhookSecret: serverEnv.STRIPE_WEBHOOK_SECRET,
        }).cancelNow(subscriptionId);
      },
    );
    // The account is gone: whatever happens to the sign-out, the user must leave this page.
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        "sign-out after deletion failed",
        error instanceof Error ? error.message : error,
      );
    }
  } catch (error) {
    return actionFail(error);
  }
  redirect("/?deleted=1");
}

/**
 * Stripe's customer portal. Always the Stripe provider, not the active one: existing Stripe
 * subscribers keep managing their subscription after the owner switches providers.
 */
export async function openPortalAction(): Promise<ActionResult<{ url: string }>> {
  try {
    const { user, supabase } = await requireUser();
    const provider = createStripeProvider({
      secretKey: serverEnv.STRIPE_SECRET_KEY,
      webhookSecret: serverEnv.STRIPE_WEBHOOK_SECRET,
    });
    return actionOk(
      await openPortal(supabase, provider, { userId: user.id, appUrl: serverEnv.APP_URL }),
    );
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      return { ok: false, message: "Плащането още не е настроено. Опитай по-късно." };
    }
    return actionFail(error);
  }
}

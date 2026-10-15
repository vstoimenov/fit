"use server";

import { z } from "zod";
import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { requireUser } from "@/server/auth/require-user";
import { startCheckout } from "@/server/payments/checkout";
import { ProviderUnavailableError } from "@/server/payments/provider";
import { getActiveProvider } from "@/server/payments/registry";

const NOT_CONFIGURED = "Плащането още не е настроено. Опитай по-късно.";

export async function startCheckoutAction(planId: string): Promise<ActionResult<{ url: string }>> {
  try {
    const { user, supabase } = await requireUser();
    const provider = await getActiveProvider(supabase, serverEnv);
    if (!provider.ready) throw new AppError("INVALID", NOT_CONFIGURED);
    return actionOk(
      await startCheckout(supabase, provider, {
        userId: user.id,
        email: user.email ?? "",
        planId: z.uuid().parse(planId),
        appUrl: serverEnv.APP_URL,
      }),
    );
  } catch (error) {
    if (error instanceof ProviderUnavailableError) return { ok: false, message: NOT_CONFIGURED };
    return actionFail(error);
  }
}

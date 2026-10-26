"use server";

import { redirect } from "next/navigation";
import { serverEnv } from "@/env";
import { actionFail } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { giftOption, giftOrderSchema, giftProductName } from "@/server/gift/purchase";
import { ProviderUnavailableError } from "@/server/payments/provider";
import { getActiveProvider } from "@/server/payments/registry";

export type GiftOrderState = { status: "idle" | "error"; message?: string };

const NOT_CONFIGURED = "Плащането още не е включено. Опитай по-късно.";

/** The buyer's order: validate, price it ourselves, send her to Stripe Checkout. */
export async function startGiftCheckoutAction(
  _prev: GiftOrderState,
  form: FormData,
): Promise<GiftOrderState> {
  let url: string;
  try {
    const order = giftOrderSchema.parse({
      months: form.get("months"),
      email: form.get("email"),
      recipientName: form.get("recipientName"),
      message: form.get("message"),
    });
    // No account here: the provider lookup runs with the service role.
    const provider = await getActiveProvider(createAdminSupabaseClient(), serverEnv);
    if (!provider.ready) throw new AppError("INVALID", NOT_CONFIGURED);
    const option = giftOption(order.months);
    ({ url } = await provider.createGiftCheckout({
      months: order.months,
      amountCents: option.priceCents,
      currency: "EUR",
      productName: giftProductName(order.months),
      buyerEmail: order.email,
      recipientName: order.recipientName,
      message: order.message,
      successUrl: `${serverEnv.APP_URL}/podari/blagodarya?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${serverEnv.APP_URL}/podari#porachka`,
    }));
  } catch (error) {
    if (error instanceof ProviderUnavailableError)
      return { status: "error", message: NOT_CONFIGURED };
    return { status: "error", message: actionFail(error).message };
  }
  redirect(url);
}

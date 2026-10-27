"use server";

import { redirect } from "next/navigation";
import { serverEnv } from "@/env";
import { actionFail } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { giftOption, giftOrderSchema, giftProductName } from "@/server/gift/purchase";
import { ProviderUnavailableError } from "@/server/payments/provider";
import { createStripeProvider } from "@/server/payments/stripe-provider";

export type GiftOrderState = {
  status: "idle" | "error";
  message?: string;
  /** What she typed, so an error does not wipe the form. */
  values?: { months: string; email: string; recipientName: string; message: string };
};

const typed = (form: FormData) => ({
  months: String(form.get("months") ?? "").slice(0, 3),
  email: String(form.get("email") ?? "").slice(0, 254),
  recipientName: String(form.get("recipientName") ?? "").slice(0, 60),
  message: String(form.get("message") ?? "").slice(0, 300),
});

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
    // Gifts always go through Stripe (the gift webhook is Stripe's), whatever plan provider is active.
    const provider = createStripeProvider({
      secretKey: serverEnv.STRIPE_SECRET_KEY,
      webhookSecret: serverEnv.STRIPE_WEBHOOK_SECRET,
    });
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
    const message =
      error instanceof ProviderUnavailableError ? NOT_CONFIGURED : actionFail(error).message;
    return { status: "error", message, values: typed(form) };
  }
  redirect(url);
}

import { AppError } from "@/lib/app-error";
import { paidSubOpen } from "@/lib/subscription-text";
import type { TypedClient } from "@/server/db/types";
import type { PaymentProvider } from "./provider";

/** The provider's price id stored on a plan, or null when the plan cannot be paid through it. */
export function priceIdFor(
  plan: { provider_price_ids: unknown },
  provider: PaymentProvider["name"],
): string | null {
  const id = (plan.provider_price_ids as Record<string, unknown> | null)?.[provider];
  return typeof id === "string" && id ? id : null;
}

export const CARD_UPDATE_MESSAGE = "Плащането за абонамента ти не е минало — обнови картата си.";

/** Her stored subscription failed to renew but can still be charged: she must fix the card, not buy again. */
export function needsCardUpdate(
  sub: { provider: string; provider_sub_id: string | null; status: string } | null,
  providerName: PaymentProvider["name"],
): boolean {
  return paidSubOpen(sub) && sub?.provider === providerName && sub.status === "past_due";
}

/**
 * A Stripe customer id is kept on the row even after it turns manual (admin_grant_manual), so
 * reuse any `cus_` id: a former subscriber keeps one customer, with her saved cards and invoices.
 */
function reusableCustomerId(
  sub: { provider_customer_id: string | null } | null,
  providerName: PaymentProvider["name"],
): string | null {
  const id = sub?.provider_customer_id;
  return providerName === "stripe" && id?.startsWith("cus_") ? id : null;
}

export async function startCheckout(
  db: TypedClient,
  provider: PaymentProvider,
  i: { userId: string; email: string; planId: string; appUrl: string },
): Promise<{ url: string }> {
  const [
    { data: access, error: accessError },
    { data: plan, error: planError },
    { data: sub, error: subError },
  ] = await Promise.all([
    db.rpc("my_access"),
    db.from("plans").select("id, active, provider_price_ids").eq("id", i.planId).maybeSingle(),
    db
      .from("subscriptions")
      .select("provider, provider_customer_id, provider_sub_id, status")
      .eq("user_id", i.userId)
      .maybeSingle(),
  ]);
  const failed = accessError ?? planError ?? subError;
  if (failed) throw new Error(`load checkout data failed: ${failed.message}`);
  // Her failed subscription is still on the provider's retry schedule: a second one would bill twice.
  if (needsCardUpdate(sub, provider.name)) {
    throw new AppError("CONFLICT", CARD_UPDATE_MESSAGE);
  }
  // A comped member (access from a manual grant) may convert to a paid plan; the paid one replaces it.
  if (access && sub?.provider !== "manual") {
    throw new AppError("CONFLICT", "Вече имаш активен абонамент.");
  }
  if (!plan || !plan.active) throw new AppError("NOT_FOUND", "Планът не е намерен.");
  const priceId = priceIdFor(plan, provider.name);
  if (!priceId) {
    throw new AppError("INVALID", "Този план още не може да се плати онлайн.");
  }
  return provider.createCheckout({
    userId: i.userId,
    email: i.email,
    customerId: reusableCustomerId(sub, provider.name),
    priceId,
    successUrl: `${i.appUrl}/app/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${i.appUrl}/app/plan`,
  });
}

export async function openPortal(
  db: TypedClient,
  provider: PaymentProvider,
  i: { userId: string; appUrl: string },
): Promise<{ url: string }> {
  const { data: sub, error } = await db
    .from("subscriptions")
    .select("provider, provider_customer_id")
    .eq("user_id", i.userId)
    .maybeSingle();
  if (error) throw new Error(`load subscription failed: ${error.message}`);
  if (!sub?.provider_customer_id || sub.provider !== provider.name) {
    throw new AppError("NOT_FOUND", "Няма абонамент за управление.");
  }
  return provider.createPortal({
    customerId: sub.provider_customer_id,
    returnUrl: `${i.appUrl}/app/profile`,
  });
}

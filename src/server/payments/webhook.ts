import { paidSubOpen } from "@/lib/subscription-text";
import type { TypedClient } from "@/server/db/types";
import {
  applySubscriptionEvent,
  markPaymentEvent,
  previousSubscription,
  recordPaymentEvent,
  type PreviousSubscription,
} from "./apply-event";
import type { GiftPurchase } from "@/server/gift/purchase";
import { WebhookSignatureError, type ParsedWebhook, type PaymentProvider } from "./provider";

/** Verify → store once → apply → mark processed. A 500 makes the provider retry later. */
export async function handleWebhook(
  provider: PaymentProvider,
  rawBody: string,
  headers: Headers,
  admin: TypedClient,
  hooks: { onGift?: (gift: GiftPurchase) => Promise<unknown> } = {},
): Promise<{ status: number; body: string }> {
  let parsed: ParsedWebhook;
  try {
    parsed = await provider.parseWebhook(rawBody, headers);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return { status: 400, body: "invalid signature" };
    // e.g. the provider could not be reached to read the current subscription: retry later.
    console.error(
      "payment webhook parse failed",
      error instanceof Error ? error.message : "unknown",
    );
    return { status: 500, body: "retry" };
  }
  try {
    const state = await recordPaymentEvent(admin, {
      provider: provider.name,
      eventId: parsed.eventId,
      type: parsed.type,
      userId: parsed.event?.userId ?? null,
      payload: parsed.payload,
    });
    if (state === "seen") return { status: 200, body: "duplicate" };
    if (parsed.gift && hooks.onGift) {
      await hooks.onGift(parsed.gift);
      await markPaymentEvent(admin, provider.name, parsed.eventId, null);
      return { status: 200, body: "gift" };
    }
    if (!parsed.event) {
      await markPaymentEvent(admin, provider.name, parsed.eventId, null);
      return { status: 200, body: "ignored" };
    }
    // A new live subscription replaces the stored one (e.g. a second Checkout from an old tab):
    // remember the old one so it can be cancelled at the provider and she is not billed twice.
    const isLive = parsed.event.status === "active" || parsed.event.status === "trialing";
    const previous = isLive ? await previousSubscription(admin, parsed.event) : null;
    const result = await applySubscriptionEvent(admin, parsed.event);
    if (result === "applied" && previous) {
      await cancelReplaced(provider, previous, parsed.event.subscriptionId);
    }
    await markPaymentEvent(
      admin,
      provider.name,
      parsed.eventId,
      result === "no_user" ? "no matching user" : null,
    );
    return { status: 200, body: result };
  } catch (error) {
    console.error(
      "payment webhook apply failed",
      parsed.eventId,
      error instanceof Error ? error.message : "unknown",
    );
    return { status: 500, body: "retry" };
  }
}

/** Best effort: a failure is logged (ids only) and never changes the webhook's answer. */
async function cancelReplaced(
  provider: PaymentProvider,
  previous: PreviousSubscription,
  newSubscriptionId: string,
): Promise<void> {
  // Gated on "may still be charged", not on access: a past_due one beyond our grace is still on
  // the provider's retry schedule.
  const open = paidSubOpen({
    provider: previous.provider,
    provider_sub_id: previous.subscriptionId,
    status: previous.status,
  });
  if (
    !open ||
    previous.provider !== provider.name ||
    !previous.subscriptionId ||
    previous.subscriptionId === newSubscriptionId
  ) {
    return;
  }
  try {
    await provider.cancelNow(previous.subscriptionId);
  } catch (error) {
    console.error(
      "cancel replaced subscription failed",
      previous.subscriptionId,
      newSubscriptionId,
      error instanceof Error ? error.name : "unknown",
    );
  }
}

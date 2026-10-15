import Stripe from "stripe";
import { normalizeStripeEvent } from "@/lib/payments/stripe-normalize";
import { ProviderUnavailableError, WebhookSignatureError, type PaymentProvider } from "./provider";

/** The slice of the Stripe client we use; tests pass a fake. */
export interface StripeLike {
  checkout: {
    sessions: {
      create: (
        params: Stripe.Checkout.SessionCreateParams,
        options?: Stripe.RequestOptions,
      ) => Promise<{ url: string | null }>;
    };
  };
  billingPortal: {
    sessions: {
      create: (params: Stripe.BillingPortal.SessionCreateParams) => Promise<{ url: string }>;
    };
  };
  subscriptions: {
    cancel: (id: string) => Promise<unknown>;
    retrieve: (id: string) => Promise<unknown>;
  };
  webhooks: Pick<Stripe["webhooks"], "constructEvent">;
}

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const isResourceMissing = (error: unknown) =>
  error instanceof Stripe.errors.StripeError && error.code === "resource_missing";

export function createStripeProvider(
  config: { secretKey?: string; webhookSecret?: string },
  client?: StripeLike,
): PaymentProvider {
  const ready = Boolean(config.secretKey && config.webhookSecret);
  const stripe: StripeLike | null =
    client ??
    (config.secretKey
      ? (new Stripe(config.secretKey, {
          timeout: 10_000,
          maxNetworkRetries: 2,
        }) as unknown as StripeLike)
      : null);
  const need = () => {
    if (!ready || !stripe) throw new ProviderUnavailableError("stripe");
    return stripe;
  };

  /**
   * Webhooks can arrive out of order or be replayed, so the payload may describe a past state.
   * Re-read the subscription and normalise what Stripe says now; the event keeps its own id,
   * type and timestamp. Errors other than "subscription no longer exists" propagate, so the
   * handler answers 500 and Stripe retries.
   */
  async function withCurrentSubscription(event: Stripe.Event): Promise<Stripe.Event> {
    if (!SUBSCRIPTION_EVENTS.has(event.type)) return event;
    const { id } = event.data.object as Stripe.Subscription;
    try {
      const current = (await need().subscriptions.retrieve(id)) as Stripe.Subscription;
      // Event is a ~270-member union, too large for tsc to compare structurally.
      return { ...event, data: { ...event.data, object: current } } as unknown as Stripe.Event;
    } catch (error) {
      if (event.type === "customer.subscription.deleted" && isResourceMissing(error)) return event;
      throw error;
    }
  }

  return {
    name: "stripe",
    ready,
    async createCheckout(i) {
      const session = await need().checkout.sessions.create(
        {
          mode: "subscription",
          line_items: [{ price: i.priceId, quantity: 1 }],
          success_url: i.successUrl,
          cancel_url: i.cancelUrl,
          client_reference_id: i.userId,
          ...(i.customerId
            ? { customer: i.customerId }
            : i.email
              ? { customer_email: i.email }
              : {}),
          subscription_data: { metadata: { user_id: i.userId } },
          metadata: { user_id: i.userId },
          allow_promotion_codes: true,
          locale: "bg",
          // Stripe's minimum: an old tab cannot be paid much later.
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        },
        {
          // Same user + price within a minute (a double click) returns the same session.
          idempotencyKey: `checkout-${i.userId}-${i.priceId}-${Math.floor(Date.now() / 60_000)}`,
        },
      );
      if (!session.url) throw new Error("stripe returned no checkout url");
      return { url: session.url };
    },
    async createPortal(i) {
      const session = await need().billingPortal.sessions.create({
        customer: i.customerId,
        return_url: i.returnUrl,
        locale: "bg",
      });
      return { url: session.url };
    },
    async cancelNow(subscriptionId) {
      await need().subscriptions.cancel(subscriptionId);
    },
    async parseWebhook(rawBody, headers) {
      const signature = headers.get("stripe-signature");
      if (!signature || !config.webhookSecret || !stripe) {
        throw new WebhookSignatureError("missing signature or secret");
      }
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
      } catch {
        throw new WebhookSignatureError("invalid signature");
      }
      const current = await withCurrentSubscription(event);
      return {
        event: normalizeStripeEvent(current),
        eventId: event.id,
        type: event.type,
        payload: event,
      };
    },
  };
}

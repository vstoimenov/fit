import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { stripeSubscriptionEvent } from "@/lib/payments/fixtures/stripe-events";
import { ProviderUnavailableError, WebhookSignatureError } from "./provider";
import { createStripeProvider } from "./stripe-provider";

const SECRET = "whsec_test_secret";

function fakeClient(
  retrieve: (id: string) => Promise<unknown> = async () => stripeSubscriptionEvent().data.object,
) {
  return {
    checkout: {
      sessions: { create: vi.fn(async () => ({ url: "https://checkout.stripe.test/s/1" })) },
    },
    billingPortal: {
      sessions: { create: vi.fn(async () => ({ url: "https://billing.stripe.test/p/1" })) },
    },
    subscriptions: {
      cancel: vi.fn(async () => ({ id: "sub_1", status: "canceled" })),
      retrieve: vi.fn(retrieve),
    },
    webhooks: Stripe.webhooks,
  };
}

function signed(event: Stripe.Event) {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return { payload, headers: new Headers({ "stripe-signature": header }) };
}

describe("StripeProvider", () => {
  it("creates a subscription checkout tied to the user", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T10:00:30Z"));
    const client = fakeClient();
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
    const { url } = await p.createCheckout({
      userId: "u1",
      email: "ani@example.test",
      customerId: null,
      priceId: "price_1",
      successUrl: "http://localhost:3120/app/welcome?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "http://localhost:3120/app/plan",
    });
    expect(url).toBe("https://checkout.stripe.test/s/1");
    expect(client.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_1", quantity: 1 }],
        client_reference_id: "u1",
        customer_email: "ani@example.test",
        subscription_data: { metadata: { user_id: "u1" } },
        metadata: { user_id: "u1" },
        allow_promotion_codes: true,
        locale: "bg",
      }),
      {
        idempotencyKey: `checkout-u1-price_1-${Math.floor(Date.parse("2026-10-15T10:00:30Z") / 60_000)}`,
      },
    );
    vi.useRealTimers();
  });

  it("makes the same key within a minute and a new one in the next minute", async () => {
    vi.useFakeTimers();
    const client = fakeClient();
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
    const input = {
      userId: "u1",
      email: "a@example.test",
      customerId: null,
      priceId: "price_1",
      successUrl: "s",
      cancelUrl: "c",
    };
    const keys: string[] = [];
    for (const at of ["2026-10-15T10:00:05Z", "2026-10-15T10:00:55Z", "2026-10-15T10:01:05Z"]) {
      vi.setSystemTime(new Date(at));
      await p.createCheckout(input);
      const call = (
        client.checkout.sessions.create.mock.calls as unknown as [
          unknown,
          { idempotencyKey: string },
        ][]
      ).at(-1)!;
      keys.push(call[1].idempotencyKey);
    }
    vi.useRealTimers();
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    // Stripe rejects a reused idempotency key with different params.
    const params = (
      client.checkout.sessions.create.mock.calls as unknown as [Record<string, unknown>][]
    ).map((c) => c[0]);
    expect(params[1]).toEqual(params[0]);
  });

  it("expires the session 35–36 minutes out so an old tab cannot be paid much later", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
    const client = fakeClient();
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
    await p.createCheckout({
      userId: "u1",
      email: "a@example.test",
      customerId: null,
      priceId: "price_1",
      successUrl: "s",
      cancelUrl: "c",
    });
    vi.useRealTimers();
    const args = (
      client.checkout.sessions.create.mock.calls as unknown as [Record<string, unknown>][]
    )[0]![0];
    expect(args.expires_at).toBe(Date.parse("2026-10-15T10:36:00Z") / 1000);
  });

  it("sends no customer_email when the email is empty", async () => {
    const client = fakeClient();
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
    await p.createCheckout({
      userId: "u1",
      email: "",
      customerId: null,
      priceId: "price_1",
      successUrl: "s",
      cancelUrl: "c",
    });
    const args = (
      client.checkout.sessions.create.mock.calls as unknown as [Record<string, unknown>][]
    )[0]![0];
    expect(args).not.toHaveProperty("customer_email");
    expect(args).not.toHaveProperty("customer");
  });

  it("reuses an existing customer instead of the email", async () => {
    const client = fakeClient();
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
    await p.createCheckout({
      userId: "u1",
      email: "a@example.test",
      customerId: "cus_9",
      priceId: "price_1",
      successUrl: "s",
      cancelUrl: "c",
    });
    const args = (
      client.checkout.sessions.create.mock.calls as unknown as [Record<string, unknown>][]
    )[0]![0];
    expect(args.customer).toBe("cus_9");
    expect(args.customer_email).toBeUndefined();
  });

  it("verifies webhook signatures and normalises subscription events", async () => {
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, fakeClient());
    const { payload, headers } = signed(stripeSubscriptionEvent({ id: "evt_sig" }));
    const parsed = await p.parseWebhook(payload, headers);
    expect(parsed.eventId).toBe("evt_sig");
    expect(parsed.event?.status).toBe("active");
  });

  it("rejects a forged or missing signature", async () => {
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, fakeClient());
    const payload = JSON.stringify(stripeSubscriptionEvent());
    const forged = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_other" });
    await expect(
      p.parseWebhook(payload, new Headers({ "stripe-signature": forged })),
    ).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(p.parseWebhook(payload, new Headers())).rejects.toBeInstanceOf(
      WebhookSignatureError,
    );
  });

  it("is not ready without keys", async () => {
    const p = createStripeProvider({}, fakeClient());
    expect(p.ready).toBe(false);
    await expect(p.createPortal({ customerId: "cus_1", returnUrl: "r" })).rejects.toBeInstanceOf(
      ProviderUnavailableError,
    );
  });

  it("cancels a subscription immediately", async () => {
    const client = fakeClient();
    await createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client).cancelNow(
      "sub_1",
    );
    expect(client.subscriptions.cancel).toHaveBeenCalledWith("sub_1");
  });

  describe("cancelNow is idempotent", () => {
    const provider = (client: ReturnType<typeof fakeClient>) =>
      createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);

    it("resolves when the subscription no longer exists at Stripe", async () => {
      const client = fakeClient();
      client.subscriptions.cancel.mockRejectedValueOnce(
        new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such subscription: 'sub_gone'",
        }),
      );
      await expect(provider(client).cancelNow("sub_gone")).resolves.toBeUndefined();
      expect(client.subscriptions.retrieve).not.toHaveBeenCalled();
    });

    it("resolves when the subscription is already canceled", async () => {
      const client = fakeClient(async () => ({ id: "sub_1", status: "canceled" }));
      client.subscriptions.cancel.mockRejectedValueOnce(new Error("already canceled"));
      await expect(provider(client).cancelNow("sub_1")).resolves.toBeUndefined();
      expect(client.subscriptions.retrieve).toHaveBeenCalledWith("sub_1");
    });

    it("resolves when the subscription is incomplete_expired", async () => {
      const client = fakeClient(async () => ({ id: "sub_1", status: "incomplete_expired" }));
      client.subscriptions.cancel.mockRejectedValueOnce(new Error("expired"));
      await expect(provider(client).cancelNow("sub_1")).resolves.toBeUndefined();
    });

    it("rethrows the original error when the subscription is still active", async () => {
      const client = fakeClient(async () => ({ id: "sub_1", status: "active" }));
      const original = new Error("stripe down");
      client.subscriptions.cancel.mockRejectedValueOnce(original);
      await expect(provider(client).cancelNow("sub_1")).rejects.toBe(original);
    });

    it("rethrows the original error when the status check fails too", async () => {
      const client = fakeClient(async () => {
        throw new Error("retrieve failed");
      });
      const original = new Error("stripe down");
      client.subscriptions.cancel.mockRejectedValueOnce(original);
      await expect(provider(client).cancelNow("sub_1")).rejects.toBe(original);
    });
  });

  describe("re-fetching the current subscription", () => {
    it("normalises the current state, not the stale event payload", async () => {
      const client = fakeClient(
        async () => stripeSubscriptionEvent({ status: "active" }).data.object,
      );
      const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
      const stale = stripeSubscriptionEvent({
        id: "evt_old",
        status: "incomplete",
        created: 1_760_000_123,
      });
      const { payload, headers } = signed(stale);
      const parsed = await p.parseWebhook(payload, headers);
      expect(client.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
      expect(parsed.event?.status).toBe("active");
      expect(parsed.event?.eventId).toBe("evt_old");
      expect(parsed.event?.type).toBe("customer.subscription.updated");
      expect(parsed.event?.occurredAt).toBe(new Date(1_760_000_123 * 1000).toISOString());
    });

    it("propagates a retrieve failure as a non-signature error so the handler can answer 500", async () => {
      const client = fakeClient(async () => {
        throw new Error("network down");
      });
      const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
      const { payload, headers } = signed(stripeSubscriptionEvent());
      const result = p.parseWebhook(payload, headers);
      await expect(result).rejects.toThrow("network down");
      await expect(result).rejects.not.toBeInstanceOf(WebhookSignatureError);
    });

    it("falls back to the payload of a deleted event when the subscription is gone", async () => {
      const client = fakeClient(async () => {
        throw new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such subscription",
        });
      });
      const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
      const { payload, headers } = signed(
        stripeSubscriptionEvent({
          type: "customer.subscription.deleted",
          status: "canceled",
          endedAt: 1_760_000_000,
        }),
      );
      const parsed = await p.parseWebhook(payload, headers);
      expect(parsed.event?.status).toBe("canceled");
      expect(parsed.event?.subscriptionId).toBe("sub_123");
    });

    it("does not swallow resource_missing for a non-delete event", async () => {
      const client = fakeClient(async () => {
        throw new Stripe.errors.StripeInvalidRequestError({
          type: "invalid_request_error",
          code: "resource_missing",
          message: "No such subscription",
        });
      });
      const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
      const { payload, headers } = signed(stripeSubscriptionEvent());
      await expect(p.parseWebhook(payload, headers)).rejects.toThrow();
    });
  });
});

describe("StripeProvider gifts", () => {
  it("creates a one-time card payment with the server's amount and the gift metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-27T10:00:30Z"));
    const client = fakeClient();
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
    await p.createGiftCheckout({
      months: 3,
      amountCents: 7900,
      currency: "EUR",
      productName: "Подаръчен ваучер · 3 месеца",
      buyerEmail: "buyer@example.com",
      recipientName: "Ива",
      message: null,
      successUrl: "https://x/ok",
      cancelUrl: "https://x/no",
    });
    const [params, options] = client.checkout.sessions.create.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { idempotencyKey: string },
    ];
    expect(params.mode).toBe("payment");
    expect(params.allowed_payment_method_types).toEqual(["card"]);
    expect(params.line_items).toEqual([
      {
        price_data: {
          currency: "eur",
          unit_amount: 7900,
          product_data: { name: "Подаръчен ваучер · 3 месеца" },
        },
        quantity: 1,
      },
    ]);
    expect(params.metadata).toMatchObject({ kind: "gift", months: "3", recipient_name: "Ива" });
    // The key must not carry the e-mail in clear and must differ per recipient/message.
    expect(options.idempotencyKey).not.toContain("buyer@example.com");
    expect(options.idempotencyKey.length).toBeLessThanOrEqual(255);
    vi.useRealTimers();
  });

  it("keeps the remaining manual months as a trial when a member converts to a paid plan", async () => {
    const client = fakeClient();
    const p = createStripeProvider({ secretKey: "sk_test_x", webhookSecret: SECRET }, client);
    await p.createCheckout({
      userId: "u1",
      email: "m@x.bg",
      customerId: null,
      priceId: "price_1",
      successUrl: "https://x/ok",
      cancelUrl: "https://x/no",
      trialEnd: 1_800_000_000,
    });
    const [params] = client.checkout.sessions.create.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(params.subscription_data).toMatchObject({ trial_end: 1_800_000_000 });
  });
});

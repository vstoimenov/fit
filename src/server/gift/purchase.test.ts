import { describe, expect, it, vi } from "vitest";
import type { TypedClient } from "@/server/db/types";
import { applyGiftPurchase, giftFromStripeSession, giftOrderSchema } from "./purchase";

describe("giftOrderSchema", () => {
  it("accepts a form order and trims the optional fields", () => {
    expect(
      giftOrderSchema.parse({
        months: "3",
        email: " Buyer@Example.com ",
        recipientName: " Ива ",
        message: "",
      }),
    ).toEqual({ months: 3, email: "buyer@example.com", recipientName: "Ива", message: null });
  });
  it("rejects unknown month counts and long messages", () => {
    expect(() => giftOrderSchema.parse({ months: "2", email: "a@b.bg" })).toThrow();
    expect(() =>
      giftOrderSchema.parse({ months: "1", email: "a@b.bg", message: "x".repeat(301) }),
    ).toThrow();
  });
});

const session = (over: Record<string, unknown> = {}) => ({
  id: "evt_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_1",
      mode: "payment",
      payment_status: "paid",
      amount_total: 7900,
      currency: "eur",
      customer_details: { email: "buyer@example.com" },
      metadata: { kind: "gift", months: "3", recipient_name: "Ива", message: "Честит рожден ден!" },
      ...over,
    },
  },
});

describe("giftFromStripeSession", () => {
  it("reads a paid gift session", () => {
    expect(giftFromStripeSession(session() as never)).toEqual({
      sessionId: "cs_test_1",
      months: 3,
      amountCents: 7900,
      currency: "EUR",
      buyerEmail: "buyer@example.com",
      recipientName: "Ива",
      message: "Честит рожден ден!",
    });
  });
  it("also accepts the async success event for delayed payment methods", () => {
    const async = { ...session(), type: "checkout.session.async_payment_succeeded" };
    expect(giftFromStripeSession(async as never)?.sessionId).toBe("cs_test_1");
  });

  it("ignores subscriptions, unpaid sessions and sessions without the gift marker", () => {
    expect(giftFromStripeSession(session({ mode: "subscription" }) as never)).toBeNull();
    expect(giftFromStripeSession(session({ payment_status: "unpaid" }) as never)).toBeNull();
    expect(giftFromStripeSession(session({ metadata: { months: "3" } }) as never)).toBeNull();
    expect(
      giftFromStripeSession({ ...session(), type: "payment_intent.succeeded" } as never),
    ).toBeNull();
  });
});

const gift = {
  sessionId: "cs_test_1",
  months: 3,
  amountCents: 7900,
  currency: "EUR",
  buyerEmail: "buyer@example.com",
  recipientName: "Ива",
  message: null,
};

function fakeAdmin(insertError: { code: string; message: string } | null, existing = "EXISTINGCO") {
  const inserted: unknown[] = [];
  const db = {
    from: () => ({
      insert: (row: unknown) => {
        inserted.push(row);
        return {
          select: () => ({
            single: async () => ({
              data: insertError ? null : { code: (row as { code: string }).code },
              error: insertError,
            }),
          }),
        };
      },
      select: () => ({
        eq: () => ({ single: async () => ({ data: { code: existing }, error: null }) }),
      }),
    }),
  } as unknown as TypedClient;
  return { db, inserted };
}

describe("applyGiftPurchase", () => {
  it("creates the voucher once and e-mails the buyer the code and the card link", async () => {
    const { db, inserted } = fakeAdmin(null);
    const send = vi.fn().mockResolvedValue({ delivered: true });
    const res = await applyGiftPurchase(db, gift, { send }, "https://iamstrong.bg");
    expect(res.created).toBe(true);
    expect(res.code).toMatch(/^[A-Z2-9]{10}$/);
    expect(inserted[0]).toMatchObject({
      kind: "stripe",
      months: 3,
      amount_cents: 7900,
      stripe_session_id: "cs_test_1",
      buyer_email: "buyer@example.com",
    });
    const msg = send.mock.calls[0][0] as { to: string; text: string };
    expect(msg.to).toBe("buyer@example.com");
    expect(msg.text).toContain(`IAM-${res.code.slice(0, 5)}-${res.code.slice(5)}`);
    expect(msg.text).toContain(`https://iamstrong.bg/podari/karta/${res.code}`);
  });

  it("is idempotent per Stripe session: a replayed webhook sends nothing", async () => {
    const { db } = fakeAdmin({ code: "23505", message: "dup" });
    const send = vi.fn();
    const res = await applyGiftPurchase(db, gift, { send }, "https://iamstrong.bg");
    expect(res).toEqual({ code: "EXISTINGCO", created: false });
    expect(send).not.toHaveBeenCalled();
  });
});

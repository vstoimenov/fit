import { describe, expect, it, vi } from "vitest";
import type { NormalizedSubscriptionEvent } from "@/lib/payments/types";
import type { TypedClient } from "@/server/db/types";
import { WebhookSignatureError, type PaymentProvider } from "./provider";

vi.mock("./apply-event", () => ({
  recordPaymentEvent: vi.fn(),
  markPaymentEvent: vi.fn(),
  applySubscriptionEvent: vi.fn(),
  previousSubscription: vi.fn(),
}));
const applyMod = await import("./apply-event");
const { handleWebhook } = await import("./webhook");

const db = {} as TypedClient;
const normalized = { eventId: "evt_1", userId: "u1" } as NormalizedSubscriptionEvent;

function provider(parse: PaymentProvider["parseWebhook"]): PaymentProvider {
  return { name: "stripe", ready: true, parseWebhook: parse } as PaymentProvider;
}

describe("handleWebhook", () => {
  it("answers 400 to a bad signature and stores nothing", async () => {
    const res = await handleWebhook(
      provider(async () => {
        throw new WebhookSignatureError("bad");
      }),
      "{}",
      new Headers(),
      db,
    );
    expect(res.status).toBe(400);
    expect(applyMod.recordPaymentEvent).not.toHaveBeenCalled();
  });

  it("answers 500 when parsing fails for a non-signature reason", async () => {
    const res = await handleWebhook(
      provider(async () => {
        throw new Error("stripe unreachable");
      }),
      "{}",
      new Headers(),
      db,
    );
    expect(res.status).toBe(500);
    expect(applyMod.recordPaymentEvent).not.toHaveBeenCalled();
  });

  it("skips an already processed event", async () => {
    vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("seen");
    const res = await handleWebhook(
      provider(async () => ({ event: normalized, eventId: "evt_1", type: "t", payload: {} })),
      "{}",
      new Headers(),
      db,
    );
    expect(res.status).toBe(200);
    expect(applyMod.applySubscriptionEvent).not.toHaveBeenCalled();
  });

  it("applies a new event and marks it processed", async () => {
    vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("new");
    vi.mocked(applyMod.applySubscriptionEvent).mockResolvedValueOnce("applied");
    const res = await handleWebhook(
      provider(async () => ({ event: normalized, eventId: "evt_1", type: "t", payload: {} })),
      "{}",
      new Headers(),
      db,
    );
    expect(res.status).toBe(200);
    expect(applyMod.markPaymentEvent).toHaveBeenCalledWith(db, "stripe", "evt_1", null);
  });

  it("marks stale and ignored results processed without an error", async () => {
    for (const result of ["stale", "ignored"] as const) {
      vi.mocked(applyMod.markPaymentEvent).mockClear();
      vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("new");
      vi.mocked(applyMod.applySubscriptionEvent).mockResolvedValueOnce(result);
      const res = await handleWebhook(
        provider(async () => ({ event: normalized, eventId: "evt_s", type: "t", payload: {} })),
        "{}",
        new Headers(),
        db,
      );
      expect(res.status).toBe(200);
      expect(applyMod.markPaymentEvent).toHaveBeenCalledWith(db, "stripe", "evt_s", null);
    }
  });

  it("records 'no matching user' when the event cannot be tied to anyone", async () => {
    vi.mocked(applyMod.markPaymentEvent).mockClear();
    vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("new");
    vi.mocked(applyMod.applySubscriptionEvent).mockResolvedValueOnce("no_user");
    const res = await handleWebhook(
      provider(async () => ({ event: normalized, eventId: "evt_n", type: "t", payload: {} })),
      "{}",
      new Headers(),
      db,
    );
    expect(res.status).toBe(200);
    expect(applyMod.markPaymentEvent).toHaveBeenCalledWith(
      db,
      "stripe",
      "evt_n",
      "no matching user",
    );
  });

  it("marks ignored event types processed without applying", async () => {
    vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("new");
    const res = await handleWebhook(
      provider(async () => ({ event: null, eventId: "evt_2", type: "invoice.paid", payload: {} })),
      "{}",
      new Headers(),
      db,
    );
    expect(res.status).toBe(200);
    expect(applyMod.markPaymentEvent).toHaveBeenCalledWith(db, "stripe", "evt_2", null);
  });

  it("answers 500 and leaves the event unprocessed when applying fails", async () => {
    vi.mocked(applyMod.markPaymentEvent).mockClear();
    vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("new");
    vi.mocked(applyMod.applySubscriptionEvent).mockRejectedValueOnce(new Error("db down"));
    const res = await handleWebhook(
      provider(async () => ({ event: normalized, eventId: "evt_3", type: "t", payload: {} })),
      "{}",
      new Headers(),
      db,
    );
    expect(res.status).toBe(500);
    expect(applyMod.markPaymentEvent).not.toHaveBeenCalled();
  });

  describe("replacing a live subscription with a new one", () => {
    const incoming = {
      eventId: "evt_new",
      userId: "u1",
      status: "active",
      subscriptionId: "sub_new",
    } as NormalizedSubscriptionEvent;
    const live = { provider: "stripe", subscriptionId: "sub_old", status: "active" } as const;

    async function run(opts: {
      previous: Awaited<ReturnType<typeof applyMod.previousSubscription>>;
      result: "applied" | "stale" | "ignored" | "no_user";
      event?: Partial<NormalizedSubscriptionEvent>;
      cancelNow?: () => Promise<void>;
    }) {
      const cancelNow = vi.fn(opts.cancelNow ?? (async () => {}));
      vi.mocked(applyMod.recordPaymentEvent).mockResolvedValueOnce("new");
      vi.mocked(applyMod.previousSubscription).mockResolvedValueOnce(opts.previous);
      vi.mocked(applyMod.applySubscriptionEvent).mockResolvedValueOnce(opts.result);
      const res = await handleWebhook(
        {
          name: "stripe",
          ready: true,
          cancelNow,
          parseWebhook: async () => ({
            event: { ...incoming, ...opts.event },
            eventId: "evt_new",
            type: "t",
            payload: {},
          }),
        } as unknown as PaymentProvider,
        "{}",
        new Headers(),
        db,
      );
      return { res, cancelNow };
    }

    it("cancels the previous live subscription at the provider, once", async () => {
      const { res, cancelNow } = await run({ previous: live, result: "applied" });
      expect(res).toEqual({ status: 200, body: "applied" });
      expect(cancelNow).toHaveBeenCalledTimes(1);
      expect(cancelNow).toHaveBeenCalledWith("sub_old");
    });

    it("also cancels when the new subscription is trialing", async () => {
      const { cancelNow } = await run({
        previous: live,
        result: "applied",
        event: { status: "trialing" },
      });
      expect(cancelNow).toHaveBeenCalledWith("sub_old");
    });

    it("does not cancel the same subscription", async () => {
      const { cancelNow } = await run({
        previous: { ...live, subscriptionId: "sub_new" },
        result: "applied",
      });
      expect(cancelNow).not.toHaveBeenCalled();
    });

    it("does not cancel another provider's subscription or a canceled or missing one", async () => {
      for (const previous of [
        { ...live, provider: "manual" },
        { ...live, status: "canceled" as const },
        { ...live, subscriptionId: null },
        null,
      ]) {
        const { cancelNow } = await run({ previous, result: "applied" });
        expect(cancelNow).not.toHaveBeenCalled();
      }
    });

    it("cancels a past_due one even after our grace: Stripe may still retry the charge", async () => {
      const { cancelNow } = await run({
        previous: { ...live, status: "past_due" },
        result: "applied",
      });
      expect(cancelNow).toHaveBeenCalledWith("sub_old");
    });

    it("does not cancel unless the event was applied", async () => {
      for (const result of ["stale", "ignored", "no_user"] as const) {
        const { cancelNow } = await run({ previous: live, result });
        expect(cancelNow).not.toHaveBeenCalled();
      }
    });

    it("does not cancel for a non-live incoming status", async () => {
      const { cancelNow } = await run({
        previous: live,
        result: "applied",
        event: { status: "past_due" },
      });
      expect(cancelNow).not.toHaveBeenCalled();
    });

    it("keeps answering 200 when the provider cancel fails", async () => {
      const { res, cancelNow } = await run({
        previous: live,
        result: "applied",
        cancelNow: async () => {
          throw new Error("stripe down");
        },
      });
      expect(cancelNow).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ status: 200, body: "applied" });
    });
  });
});

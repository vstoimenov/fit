import { describe, expect, it } from "vitest";
import { trialEndFor } from "./checkout";
import { priceIdFor } from "./checkout";

describe("priceIdFor", () => {
  it("returns the price id stored for the provider", () => {
    expect(priceIdFor({ provider_price_ids: { stripe: "price_1" } }, "stripe")).toBe("price_1");
  });

  it("returns null for a missing, empty or non-string price id", () => {
    expect(priceIdFor({ provider_price_ids: {} }, "stripe")).toBeNull();
    expect(priceIdFor({ provider_price_ids: { stripe: "" } }, "stripe")).toBeNull();
    expect(priceIdFor({ provider_price_ids: { stripe: 5 } }, "stripe")).toBeNull();
    expect(priceIdFor({ provider_price_ids: { revolut: "r" } }, "stripe")).toBeNull();
    expect(priceIdFor({ provider_price_ids: null }, "stripe")).toBeNull();
  });
});

describe("trialEndFor", () => {
  const now = new Date("2026-10-27T10:00:00Z");
  it("carries a live manual period over as the Stripe trial end (unix seconds)", () => {
    const end = "2026-12-01T10:00:00Z";
    expect(
      trialEndFor({ provider: "manual", status: "active", current_period_end: end }, now),
    ).toBe(Date.parse(end) / 1000);
  });
  it("gives nothing for a period ending within 48 hours, a non-manual row, or no row", () => {
    expect(
      trialEndFor(
        { provider: "manual", status: "active", current_period_end: "2026-10-28T09:00:00Z" },
        now,
      ),
    ).toBeUndefined();
    expect(
      trialEndFor(
        { provider: "stripe", status: "active", current_period_end: "2026-12-01T10:00:00Z" },
        now,
      ),
    ).toBeUndefined();
    expect(trialEndFor(null, now)).toBeUndefined();
  });
  it("caps at Stripe's 730-day maximum", () => {
    const far = "2029-10-27T10:00:00Z";
    const capped = trialEndFor(
      { provider: "manual", status: "active", current_period_end: far },
      now,
    )!;
    expect(capped).toBeLessThanOrEqual(now.getTime() / 1000 + 730 * 86_400);
  });
});

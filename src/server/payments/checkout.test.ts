import { describe, expect, it } from "vitest";
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

import { describe, expect, it } from "vitest";
import { yearlyIsBestValue } from "./plan-badge";

describe("yearlyIsBestValue", () => {
  it("is true when the yearly price is below twelve months", () => {
    expect(
      yearlyIsBestValue([
        { interval: "month", price_cents: 1990 },
        { interval: "year", price_cents: 14900 },
      ]),
    ).toBe(true);
  });

  it("is false when there is no saving", () => {
    expect(
      yearlyIsBestValue([
        { interval: "month", price_cents: 1000 },
        { interval: "year", price_cents: 12000 },
      ]),
    ).toBe(false);
    expect(
      yearlyIsBestValue([
        { interval: "month", price_cents: 1000 },
        { interval: "year", price_cents: 13000 },
      ]),
    ).toBe(false);
  });

  it("is false when the monthly or yearly plan is missing", () => {
    expect(yearlyIsBestValue([{ interval: "year", price_cents: 100 }])).toBe(false);
    expect(yearlyIsBestValue([{ interval: "month", price_cents: 100 }])).toBe(false);
    expect(yearlyIsBestValue([])).toBe(false);
  });
});

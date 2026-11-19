import { describe, expect, it } from "vitest";
import { GIFT_OPTIONS } from "./gift";
import { nextPeriod, pickPlan, yearlySavings } from "./pricing";

const month = {
  id: "m",
  name: "Месечен",
  interval: "month" as const,
  price_cents: 3900,
  currency: "EUR",
};
const year = {
  id: "y",
  name: "Годишен",
  interval: "year" as const,
  price_cents: 28080,
  currency: "EUR",
};

describe("pickPlan", () => {
  it("returns the plan for the chosen period, or whichever plan exists", () => {
    expect(pickPlan([month, year], "year")).toBe(year);
    expect(pickPlan([month, year], "month")).toBe(month);
    expect(pickPlan([year], "month")).toBe(year);
    expect(pickPlan([month], "year")).toBe(month);
    expect(pickPlan([], "month")).toBeUndefined();
  });
});

describe("yearlySavings", () => {
  it("shows the per-month price and the saving when the year is cheaper", () => {
    // €39 × 12 = €468; the year is €280.80 (40% off): €23.40 a month, €187.20 saved.
    expect(yearlySavings(3900, 28080)).toEqual({
      perMonthCents: 2340,
      savesCents: 18720,
      percent: 40,
    });
  });

  it("is null when a plan is missing or the year does not save anything", () => {
    expect(yearlySavings(2900, undefined)).toBeNull();
    expect(yearlySavings(undefined, 25700)).toBeNull();
    expect(yearlySavings(1000, 12000)).toBeNull();
  });
});

describe("GIFT_OPTIONS", () => {
  it("offers 1, 3 and 12 months at the base prices", () => {
    expect(GIFT_OPTIONS.map((o) => [o.months, o.priceCents])).toEqual([
      [1, 3900],
      [3, 11700],
      [12, 28080],
    ]);
    expect(GIFT_OPTIONS[2].regularCents).toBe(46800);
  });
});

describe("nextPeriod", () => {
  it("moves with the arrow keys and wraps, like a native radio group", () => {
    expect(nextPeriod("month", "ArrowRight")).toBe("year");
    expect(nextPeriod("year", "ArrowRight")).toBe("month");
    expect(nextPeriod("month", "ArrowLeft")).toBe("year");
    expect(nextPeriod("year", "ArrowUp")).toBe("month");
    expect(nextPeriod("month", "ArrowDown")).toBe("year");
    expect(nextPeriod("year", "Home")).toBe("month");
    expect(nextPeriod("month", "End")).toBe("year");
  });

  it("ignores other keys", () => {
    expect(nextPeriod("month", "Enter")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { GIFT_OPTIONS } from "./gift";
import { yearlySavings } from "./pricing";

describe("yearlySavings", () => {
  it("shows the per-month price and the saving when the year is cheaper", () => {
    expect(yearlySavings(2900, 25700)).toEqual({ perMonthCents: 2142, savesCents: 9100 });
  });

  it("is null when a plan is missing or the year does not save anything", () => {
    expect(yearlySavings(2900, undefined)).toBeNull();
    expect(yearlySavings(undefined, 25700)).toBeNull();
    expect(yearlySavings(1000, 12000)).toBeNull();
  });
});

describe("GIFT_OPTIONS", () => {
  it("offers 1, 3 and 12 months at the spec prices", () => {
    expect(GIFT_OPTIONS.map((o) => [o.months, o.priceCents])).toEqual([
      [1, 2900],
      [3, 7900],
      [12, 25700],
    ]);
    expect(GIFT_OPTIONS[1].regularCents).toBe(8700);
  });
});

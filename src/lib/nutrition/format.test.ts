import { describe, expect, it } from "vitest";
import { formatGrams, formatNumber } from "./format";

describe("formatNumber", () => {
  it("groups thousands with a non-breaking space", () => {
    expect(formatNumber(1340)).toBe("1 340");
    expect(formatNumber(12500)).toBe("12 500");
  });
  it("leaves small numbers alone and rounds", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999.4)).toBe("999");
  });
  it("formats grams", () => {
    expect(formatGrams(62.4)).toBe("62 г");
  });
});

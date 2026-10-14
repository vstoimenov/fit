import { describe, expect, it } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it("formats euro cents the Bulgarian way", () => {
    expect(formatPrice(1990, "EUR").replace(/ /g, " ")).toBe("19,90 €");
    expect(formatPrice(14900, "EUR").replace(/ /g, " ")).toBe("149,00 €");
  });
});

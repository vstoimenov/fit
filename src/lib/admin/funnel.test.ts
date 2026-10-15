import { describe, expect, it } from "vitest";
import { stepRate } from "./funnel";

describe("stepRate", () => {
  it("has no rate without a base", () => {
    expect(stepRate(0, 0)).toBe("—");
    expect(stepRate(0, 5)).toBe("—");
  });
  it("rounds a normal share", () => {
    expect(stepRate(50, 25)).toBe("50%");
    expect(stepRate(3, 1)).toBe("33%");
    expect(stepRate(10, 0)).toBe("0%");
    expect(stepRate(7, 7)).toBe("100%");
  });
  it("caps anything above the base at 100%+", () => {
    expect(stepRate(3, 33)).toBe("100%+");
    expect(stepRate(1000, 1001)).toBe("100%+");
  });
});

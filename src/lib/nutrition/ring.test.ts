import { describe, expect, it } from "vitest";
import { ringDash } from "./ring";

const C = 2 * Math.PI * 50;

describe("ringDash", () => {
  it("uses the real circumference and hides the unfilled part with the offset", () => {
    const { circumference, offset } = ringDash(380, 1620, 50);
    expect(circumference).toBeCloseTo(C, 6);
    expect(offset).toBeCloseTo(C * (1 - 380 / 1620), 6);
  });

  it("is empty (offset = circumference) without a target or at zero", () => {
    expect(ringDash(500, null, 50).offset).toBeCloseTo(C, 6);
    expect(ringDash(500, 0, 50).offset).toBeCloseTo(C, 6);
    expect(ringDash(0, 1600, 50).offset).toBeCloseTo(C, 6);
  });

  it("is full (offset 0) at the target and clamped when over it", () => {
    expect(ringDash(1600, 1600, 50).offset).toBe(0);
    expect(ringDash(2400, 1600, 50).offset).toBe(0);
  });

  it("never goes below empty for a negative or invalid total", () => {
    expect(ringDash(-10, 1600, 50).offset).toBeCloseTo(C, 6);
    expect(ringDash(Number.NaN, 1600, 50).offset).toBeCloseTo(C, 6);
  });
});

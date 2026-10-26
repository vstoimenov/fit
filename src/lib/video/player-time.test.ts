import { describe, expect, it } from "vitest";
import { formatClock, progressPercent } from "./player-time";

describe("formatClock", () => {
  it("formats seconds as m:ss and hours as h:mm:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(725.6)).toBe("12:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });

  it("treats NaN or negative input as zero", () => {
    expect(formatClock(Number.NaN)).toBe("0:00");
    expect(formatClock(-4)).toBe("0:00");
  });
});

describe("progressPercent", () => {
  it("is the played share, clamped to 0–100", () => {
    expect(progressPercent(30, 120)).toBe(25);
    expect(progressPercent(150, 120)).toBe(100);
    expect(progressPercent(-1, 120)).toBe(0);
    expect(progressPercent(10, 0)).toBe(0);
  });
});

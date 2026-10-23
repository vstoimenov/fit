import { describe, expect, it } from "vitest";
import { sofiaHour, sofiaToday } from "./today";

describe("Sofia clock", () => {
  it("uses EEST (UTC+3) in summer", () => {
    const now = new Date("2026-07-01T17:30:00Z");
    expect(sofiaHour(now)).toBe(20);
    expect(sofiaToday(now)).toBe("2026-07-01");
  });
  it("uses EET (UTC+2) in winter and rolls the date at midnight", () => {
    const now = new Date("2026-12-31T22:05:00Z");
    expect(sofiaHour(now)).toBe(0);
    expect(sofiaToday(now)).toBe("2027-01-01");
  });
});

import { describe, expect, it } from "vitest";
import { relativeTime } from "./format";

describe("relativeTime", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  it("speaks in minutes, hours and days, Bulgarian", () => {
    expect(relativeTime("2026-10-27T11:59:30Z", now)).toBe("сега");
    expect(relativeTime("2026-10-27T11:55:00Z", now)).toBe("преди 5 мин");
    expect(relativeTime("2026-10-27T09:00:00Z", now)).toBe("преди 3 ч.");
    expect(relativeTime("2026-10-25T12:00:00Z", now)).toBe("преди 2 дни");
    expect(relativeTime("2026-10-26T12:00:00Z", now)).toBe("преди 1 ден");
  });
  it("falls back to the date after a week", () => {
    expect(relativeTime("2026-10-01T12:00:00Z", now)).toBe("1 октомври");
  });
});

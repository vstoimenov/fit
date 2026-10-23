import { describe, expect, it } from "vitest";
import { formatLongDate } from "./format-date";

describe("formatLongDate", () => {
  it("writes the day, the month in full and the year, without the trailing „г.“", () => {
    expect(formatLongDate("2026-10-12")).toBe("12 октомври 2026");
  });

  it("does not pad the day", () => {
    expect(formatLongDate("2026-03-05")).toBe("5 март 2026");
  });
});

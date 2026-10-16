import { describe, expect, it } from "vitest";
import { formatPrice, formatTodayDate } from "./format";

describe("formatPrice", () => {
  it("formats euro cents the Bulgarian way", () => {
    expect(formatPrice(1990, "EUR").replace(/ /g, " ")).toBe("19,90 €");
    expect(formatPrice(14900, "EUR").replace(/ /g, " ")).toBe("149,00 €");
  });

  it("formats the yearly per-month equivalent the plan card shows", () => {
    // 7990 / 12 = 665.83 cents, rounded to 666 before formatting.
    expect(formatPrice(Math.round(7990 / 12), "EUR").replace(/\u00a0/g, " ")).toBe("6,66 €");
  });
});

describe("formatTodayDate", () => {
  it("formats weekday, day and month in Bulgarian, capitalised", () => {
    expect(formatTodayDate(new Date("2026-10-16T09:00:00Z"))).toBe("Петък, 16 октомври");
  });

  it("uses the Sofia calendar day, not UTC", () => {
    // 22:30 UTC on the 16th is already 01:30 on the 17th in Sofia (EEST, UTC+3).
    expect(formatTodayDate(new Date("2026-10-16T22:30:00Z"))).toBe("Събота, 17 октомври");
  });

  it("accepts an explicit timezone", () => {
    expect(formatTodayDate(new Date("2026-10-16T22:30:00Z"), "UTC")).toBe("Петък, 16 октомври");
  });

  it("uses the member's own timezone, which can be behind Sofia", () => {
    // 03:00 UTC on the 17th is still the evening of the 16th in Los Angeles (PDT, UTC-7).
    expect(formatTodayDate(new Date("2026-10-17T03:00:00Z"), "America/Los_Angeles")).toBe(
      "Петък, 16 октомври",
    );
    expect(formatTodayDate(new Date("2026-10-17T03:00:00Z"))).toBe("Събота, 17 октомври");
  });
});

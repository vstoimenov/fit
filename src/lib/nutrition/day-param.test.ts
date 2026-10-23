import { describe, expect, it } from "vitest";
import { dayParamBounds, parseDayParam, shiftDay } from "./day-param";

const TODAY = "2026-10-23";

describe("parseDayParam", () => {
  it.each([
    { raw: "2026-10-24", expected: TODAY, why: "a future day is today" },
    { raw: "bad", expected: TODAY, why: "garbage is today" },
    { raw: undefined, expected: TODAY, why: "missing is today" },
    { raw: "", expected: TODAY, why: "empty is today" },
    { raw: "2026-02-30", expected: TODAY, why: "an impossible date is today" },
    { raw: "2026-1-5", expected: TODAY, why: "an unpadded date is today" },
    { raw: "2025-10-22", expected: TODAY, why: "older than 365 days is today" },
    { raw: "2026-10-01", expected: "2026-10-01", why: "a past day stays" },
    { raw: "2026-10-23", expected: TODAY, why: "today stays" },
    { raw: "2025-10-23", expected: "2025-10-23", why: "exactly 365 days back stays" },
  ])("$why", ({ raw, expected }) => {
    expect(parseDayParam(raw, TODAY)).toBe(expected);
  });
});

describe("shiftDay and bounds", () => {
  it("moves by calendar days across month ends", () => {
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDay("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("reports the earliest allowed day", () => {
    expect(dayParamBounds(TODAY)).toEqual({ min: "2025-10-23", max: TODAY });
  });
});

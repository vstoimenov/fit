import { describe, expect, it } from "vitest";
import { formatLiveStart } from "./format";

describe("formatLiveStart", () => {
  it("writes the start in the member's own timezone, capitalised, naming the zone when it is not Sofia", () => {
    const at = "2026-10-30T17:00:00Z";
    expect(formatLiveStart(at, "Europe/Sofia")).toBe("Петък, 30 октомври в 19:00");
    expect(formatLiveStart(at, "Europe/Berlin")).toBe("Петък, 30 октомври в 18:00 (Berlin)");
  });
  it("falls back to Sofia for an unknown zone", () => {
    expect(formatLiveStart("2026-10-30T17:00:00Z", "Mars/Olympus")).toBe(
      "Петък, 30 октомври в 19:00",
    );
  });
});

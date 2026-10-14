import { describe, expect, it } from "vitest";
import { utcToZoned, zonedToUtc } from "./time";

describe("zonedToUtc", () => {
  it("converts Sofia summer and winter time", () => {
    expect(zonedToUtc("2026-10-20", "07:00")).toBe("2026-10-20T04:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "07:00")).toBe("2026-12-01T05:00:00.000Z");
  });

  it("handles both DST switches", () => {
    expect(zonedToUtc("2026-10-25", "07:00")).toBe("2026-10-25T05:00:00.000Z");
    expect(zonedToUtc("2026-10-26", "07:00")).toBe("2026-10-26T05:00:00.000Z");
    expect(zonedToUtc("2026-03-29", "07:00")).toBe("2026-03-29T04:00:00.000Z");
  });

  it("supports other zones", () => {
    expect(zonedToUtc("2026-10-20", "07:00", "UTC")).toBe("2026-10-20T07:00:00.000Z");
  });
});

describe("utcToZoned", () => {
  it("is the inverse in Sofia", () => {
    expect(utcToZoned("2026-10-26T05:00:00.000Z")).toEqual({ date: "2026-10-26", time: "07:00" });
    expect(utcToZoned("2026-10-20T21:30:00.000Z")).toEqual({ date: "2026-10-21", time: "00:30" });
  });
});

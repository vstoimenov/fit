import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/app-error";
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

describe("zonedToUtc validation and DST edge cases", () => {
  it.each([
    ["2026-02-30", "07:00"],
    ["2026-13-01", "07:00"],
    ["2026-10-20", "25:00"],
    ["2026-10-20", "07:60"],
    ["2026-10-20", "7:00"],
    ["", "07:00"],
    ["2026-10-20", ""],
    ["7", "07:00"],
    ["garbage", "garbage"],
  ])("rejects %j %j with INVALID", (date, time) => {
    expect(() => zonedToUtc(date, time)).toThrowError(AppError);
    try {
      zonedToUtc(date, time);
    } catch (e) {
      expect((e as AppError).code).toBe("INVALID");
    }
  });

  it("pins the DST gap (03:30 does not exist on 2026-03-29 in Sofia)", () => {
    expect(zonedToUtc("2026-03-29", "03:30")).toBe("2026-03-29T01:30:00.000Z");
  });

  it("pins the ambiguous hour (03:30 happens twice on 2026-10-25 in Sofia)", () => {
    expect(zonedToUtc("2026-10-25", "03:30")).toBe("2026-10-25T01:30:00.000Z");
  });
});

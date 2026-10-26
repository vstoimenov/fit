import { describe, expect, it } from "vitest";
import { liveInputSchema } from "./admin";

describe("liveInputSchema", () => {
  it("turns a Sofia date and time into UTC and keeps the links strict", () => {
    const parsed = liveInputSchema.parse({
      title: "Кор и дишане",
      description: "",
      date: "2026-10-30",
      time: "19:00",
      durationMin: "45",
      joinUrl: "https://zoom.us/j/1",
      recordingUrl: "",
      published: true,
    });
    expect(parsed.startsAt).toBe("2026-10-30T17:00:00.000Z");
    expect(parsed.durationMin).toBe(45);
    expect(parsed.recordingUrl).toBeNull();
  });
  it("rejects http links and absurd durations", () => {
    const base = {
      title: "x",
      description: "",
      date: "2026-10-30",
      time: "19:00",
      durationMin: "60",
      joinUrl: "http://zoom.us/j/1",
      recordingUrl: "",
      published: false,
    };
    expect(() => liveInputSchema.parse(base)).toThrow();
    expect(() =>
      liveInputSchema.parse({ ...base, joinUrl: "https://zoom.us/j/1", durationMin: "5" }),
    ).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { countsTime, formatClock, progressPercent, unlockThreshold } from "./player-time";

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

describe("countsTime", () => {
  it("counts a YouTube second only while playing and visible", () => {
    expect(countsTime("youtube", { playing: true, visible: true })).toBe(true);
    expect(countsTime("youtube", { playing: false, visible: true })).toBe(false);
    expect(countsTime("youtube", { playing: true, visible: false })).toBe(false);
  });

  it("counts a plain-iframe provider while visible, since it cannot report playback", () => {
    expect(countsTime("vimeo", { playing: false, visible: true })).toBe(true);
    expect(countsTime("bunny", { playing: false, visible: false })).toBe(false);
  });
});

describe("unlockThreshold", () => {
  it("never asks for more than 70% of the real video length", () => {
    // Admin typed 20 min (threshold 840 s) but the video is 13 min: 70% of 780 s.
    expect(unlockThreshold(840, 780)).toBe(546);
    expect(unlockThreshold(840, 1800)).toBe(840);
  });

  it("keeps the planned threshold while the length is unknown", () => {
    expect(unlockThreshold(840, 0)).toBe(840);
    expect(unlockThreshold(840, Number.NaN)).toBe(840);
  });
});

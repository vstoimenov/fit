import { describe, expect, it } from "vitest";
import {
  canStillTick,
  challengeStatus,
  dayDate,
  firstDayFor,
  formatChallengeDate,
  isDay,
  progress,
  tickableDays,
} from "./calendar";

// 14-day challenge starting Sunday 2026-10-25: day 1 = 10-25, day 14 = 11-07 (crosses a month end).
const START = "2026-10-25";
const DAYS = 14;

describe("dayDate", () => {
  it("maps day 1 to the start date and counts on across a month end", () => {
    expect(dayDate(START, 1)).toBe("2026-10-25");
    expect(dayDate(START, 8)).toBe("2026-11-01");
    expect(dayDate(START, 14)).toBe("2026-11-07");
  });
});

describe("isDay", () => {
  it("accepts real YYYY-MM-DD dates only", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-13-01")).toBe(false);
    expect(isDay("26-10-25")).toBe(false);
    expect(isDay("2026-10-25T00:00")).toBe(false);
  });
});

describe("challengeStatus", () => {
  it("is upcoming the day before the start, with no day number", () => {
    expect(challengeStatus(START, DAYS, "2026-10-24")).toEqual({ status: "upcoming", day: null });
  });

  it("is running from the start day (day 1) through the last day (day 14)", () => {
    expect(challengeStatus(START, DAYS, "2026-10-25")).toEqual({ status: "running", day: 1 });
    expect(challengeStatus(START, DAYS, "2026-11-01")).toEqual({ status: "running", day: 8 });
    expect(challengeStatus(START, DAYS, "2026-11-07")).toEqual({ status: "running", day: 14 });
  });

  it("is ended from the day after the last day, with no day number", () => {
    expect(challengeStatus(START, DAYS, "2026-11-08")).toEqual({ status: "ended", day: null });
  });
});

describe("firstDayFor", () => {
  it("is day 1 for someone who joined on or before the start", () => {
    expect(firstDayFor(START, START)).toBe(1);
    expect(firstDayFor(START, "2026-10-20")).toBe(1);
  });

  it("is the day of the join for a late joiner", () => {
    expect(firstDayFor(START, "2026-10-28")).toBe(4);
    expect(firstDayFor(START, "2026-11-07")).toBe(14);
  });
});

describe("tickableDays", () => {
  it("allows only today on the first day (yesterday is before the challenge)", () => {
    expect(tickableDays(START, DAYS, 1, "2026-10-25")).toEqual([1]);
  });

  it("allows yesterday and today once the challenge has run a day", () => {
    expect(tickableDays(START, DAYS, 1, "2026-10-26")).toEqual([1, 2]);
  });

  it("never allows a day before the late joiner's first day", () => {
    // Joined on day 4 (2026-10-28); on that day yesterday (day 3) is before her first day.
    expect(tickableDays(START, DAYS, 4, "2026-10-28")).toEqual([4]);
    expect(tickableDays(START, DAYS, 4, "2026-10-29")).toEqual([4, 5]);
  });

  it("allows the last day the day after it ends, and nothing further", () => {
    expect(tickableDays(START, DAYS, 1, "2026-11-08")).toEqual([14]);
    expect(tickableDays(START, DAYS, 1, "2026-11-09")).toEqual([]);
  });

  it("allows nothing before the challenge starts", () => {
    expect(tickableDays(START, DAYS, 1, "2026-10-24")).toEqual([]);
  });
});

describe("progress", () => {
  it("counts ticked days against the days from the first day to the end", () => {
    expect(progress(1, DAYS, 5)).toEqual({ done: 5, total: 14, finished: false });
  });

  it("uses the late joiner's own total (days 4..14 is 11)", () => {
    expect(progress(4, DAYS, 10)).toEqual({ done: 10, total: 11, finished: false });
    expect(progress(4, DAYS, 11)).toEqual({ done: 11, total: 11, finished: true });
  });

  it("is finished when every counted day is ticked", () => {
    expect(progress(1, DAYS, 14)).toEqual({ done: 14, total: 14, finished: true });
  });
});

describe("formatChallengeDate", () => {
  it("uses the fixed Bulgarian month table of the diary labels", () => {
    expect(formatChallengeDate("2026-11-01")).toBe("1 ное");
    expect(formatChallengeDate("2026-10-15")).toBe("15 окт");
    expect(formatChallengeDate("2026-01-09")).toBe("9 яну");
  });

  it("adds the year when it is not the current year", () => {
    expect(formatChallengeDate("2027-11-01", "2026-10-25")).toBe("1 ное 2027");
    expect(formatChallengeDate("2026-11-01", "2026-10-25")).toBe("1 ное");
    expect(formatChallengeDate("2025-12-31", "2026-01-01")).toBe("31 дек 2025");
  });
});

describe("canStillTick", () => {
  it("is true while running and on the day after it ends, false before and after", () => {
    expect(canStillTick(START, DAYS, "2026-10-24")).toBe(false);
    expect(canStillTick(START, DAYS, "2026-10-25")).toBe(true);
    expect(canStillTick(START, DAYS, "2026-11-07")).toBe(true);
    expect(canStillTick(START, DAYS, "2026-11-08")).toBe(true);
    expect(canStillTick(START, DAYS, "2026-11-09")).toBe(false);
  });
});

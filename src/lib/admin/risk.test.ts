import { describe, expect, it } from "vitest";
import { assessRisk, completionPct, type RiskInput } from "./risk";

const now = new Date("2026-10-20T10:00:00Z");
const t = { inactiveDays: 5, minCompletionPct: 50 };
const base: RiskInput = {
  hasAccess: true,
  subStatus: "active",
  joinedAt: "2026-09-01T00:00:00Z",
  lastDoneAt: "2026-10-19T08:00:00Z",
  published14: 6,
  doneRegular14: 5,
  paidWithoutWorkout: false,
  snoozedUntil: null,
};

describe("assessRisk", () => {
  it("is quiet for an active, regular client", () => {
    expect(assessRisk(base, t, now)).toEqual([]);
  });

  it("flags inactivity from the last workout, or from joining if none", () => {
    expect(assessRisk({ ...base, lastDoneAt: "2026-10-14T10:00:00Z" }, t, now)).toEqual([
      "inactive",
    ]);
    expect(
      assessRisk({ ...base, lastDoneAt: null, joinedAt: "2026-10-01T00:00:00Z" }, t, now),
    ).toContain("inactive");
  });

  it("flags a low completion rate only with enough published workouts", () => {
    expect(assessRisk({ ...base, doneRegular14: 2 }, t, now)).toEqual(["low_completion"]);
    expect(assessRisk({ ...base, published14: 1, doneRegular14: 0 }, t, now)).toEqual([]);
  });

  it("flags a paid client without a first workout and a failed payment", () => {
    expect(assessRisk({ ...base, paidWithoutWorkout: true }, t, now)).toContain("no_first_workout");
    expect(assessRisk({ ...base, subStatus: "past_due" }, t, now)).toContain("past_due");
  });

  it("ignores leads without access, except a failed payment", () => {
    const lead = { ...base, hasAccess: false, subStatus: null, lastDoneAt: null, doneRegular14: 0 };
    expect(assessRisk(lead, t, now)).toEqual([]);
    expect(assessRisk({ ...lead, subStatus: "past_due" }, t, now)).toEqual(["past_due"]);
  });

  it("stays quiet while snoozed", () => {
    expect(
      assessRisk({ ...base, lastDoneAt: null, snoozedUntil: "2026-10-25T00:00:00Z" }, t, now),
    ).toEqual([]);
  });
});

describe("completionPct", () => {
  it("rounds and handles zero", () => {
    expect(completionPct(5, 9)).toBe(56);
    expect(completionPct(0, 0)).toBeNull();
  });
});

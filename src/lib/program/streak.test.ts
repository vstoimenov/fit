import { describe, expect, it } from "vitest";
import { computeStreak } from "./streak";

const slots = ["2026-10-07", "2026-10-09", "2026-10-11", "2026-10-14"];

describe("computeStreak", () => {
  it("is 0 with no slots", () => {
    expect(
      computeStreak({ slotDates: [], completionDates: ["2026-10-14"], today: "2026-10-14" }),
    ).toBe(0);
  });

  it("counts consecutive slots done, each until the next slot opens", () => {
    // 09 done on 10th (still before slot 11), 11 done same day, 14 done today.
    expect(
      computeStreak({
        slotDates: slots,
        completionDates: ["2026-10-07", "2026-10-10", "2026-10-11", "2026-10-14"],
        today: "2026-10-14",
      }),
    ).toBe(4);
  });

  it("does not break on the latest slot that is still open", () => {
    expect(
      computeStreak({
        slotDates: slots,
        completionDates: ["2026-10-07", "2026-10-09", "2026-10-11"],
        today: "2026-10-14",
      }),
    ).toBe(3);
  });

  it("stops at the first missed slot", () => {
    expect(
      computeStreak({
        slotDates: slots,
        completionDates: ["2026-10-07", "2026-10-11", "2026-10-14"],
        today: "2026-10-14",
      }),
    ).toBe(2);
  });

  it("ignores future slots and duplicate dates", () => {
    expect(
      computeStreak({
        slotDates: [...slots, "2026-10-20", "2026-10-14"],
        completionDates: ["2026-10-14", "2026-10-14"],
        today: "2026-10-14",
      }),
    ).toBe(1);
  });
});

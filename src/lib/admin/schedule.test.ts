import { describe, expect, it } from "vitest";
import { distributeDates } from "./schedule";

describe("distributeDates", () => {
  it("places items on the chosen weekdays from the start date on", () => {
    // 2026-10-19 is a Monday. Tue=1, Thu=3, Sat=5.
    expect(
      distributeDates({ startDate: "2026-10-19", weekdays: [1, 3, 5], time: "07:00", count: 5 }),
    ).toEqual([
      "2026-10-20T04:00:00.000Z",
      "2026-10-22T04:00:00.000Z",
      "2026-10-24T04:00:00.000Z",
      "2026-10-27T05:00:00.000Z",
      "2026-10-29T05:00:00.000Z",
    ]);
  });

  it("includes the start date when it matches", () => {
    expect(
      distributeDates({ startDate: "2026-10-20", weekdays: [1], time: "18:30", count: 1 }),
    ).toEqual(["2026-10-20T15:30:00.000Z"]);
  });

  it("returns nothing without weekdays or count", () => {
    expect(
      distributeDates({ startDate: "2026-10-20", weekdays: [], time: "07:00", count: 3 }),
    ).toEqual([]);
    expect(
      distributeDates({ startDate: "2026-10-20", weekdays: [1], time: "07:00", count: 0 }),
    ).toEqual([]);
  });
});

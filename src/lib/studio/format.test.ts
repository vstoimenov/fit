import { describe, expect, it } from "vitest";
import { cancelNotice, dayLabel } from "./format";

describe("dayLabel", () => {
  it("names the weekday with day and month", () => {
    expect(dayLabel("2026-11-03")).toBe("Вторник, 3.11");
    expect(dayLabel("2026-11-08")).toBe("Неделя, 8.11");
  });
});

describe("cancelNotice", () => {
  it("says which training is off and that the visit is back (Sofia time)", () => {
    // 16:00 UTC = 18:00 in Sofia in November
    expect(cancelNotice("2026-11-03T16:00:00.000Z")).toBe(
      "Тренировката във вторник, 3.11 от 18:00 е отменена. Посещението ти е върнато.",
    );
    expect(cancelNotice("2026-11-05T16:30:00.000Z")).toBe(
      "Тренировката в четвъртък, 5.11 от 18:30 е отменена. Посещението ти е върнато.",
    );
  });
});

import { describe, expect, it } from "vitest";
import { cancelNotice, dayLabel, grantPreview, rosterLabel } from "./format";

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

describe("grantPreview", () => {
  it("shows the last day and what is left after the notebook visits", () => {
    expect(grantPreview("card8", "2026-11-03", 5)).toBe("Валидна до 30.11 · остават 3");
    expect(grantPreview("card12", "2026-11-03", 0)).toBe("Валидна до 14.12 · остават 12");
  });
  it("stays empty for a bad date or too many used visits", () => {
    expect(grantPreview("card8", "", 0)).toBe("");
    expect(grantPreview("card8", "2026-11-03", 8)).toBe("");
  });
});

describe("rosterLabel", () => {
  it("names the card and what is left", () => {
    expect(rosterLabel({ card: { kind: "card8", remaining: 5 }, overLimit: false })).toBe(
      "Карта 8 · остават 5",
    );
  });
  it("marks a drop-in", () => {
    expect(rosterLabel({ card: null, overLimit: false })).toBe("7 € на място");
  });
  it("flags a walk-in over the limit", () => {
    expect(rosterLabel({ card: null, overLimit: true })).toBe("7 € на място · над лимита");
  });
});

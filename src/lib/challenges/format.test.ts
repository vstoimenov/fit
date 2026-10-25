import { describe, expect, it } from "vitest";
import {
  boardNote,
  challengeShareText,
  dayCount,
  dayLabel,
  participantsLabel,
  POINTS_TOAST,
  progressLabel,
} from "./format";

describe("dayLabel", () => {
  it("counts the running day", () => {
    expect(dayLabel("running", 3, 14, "2026-11-01")).toBe("Ден 3 от 14");
    expect(dayLabel("running", 14, 14, "2026-11-01")).toBe("Ден 14 от 14");
  });

  it("names the start date of an upcoming challenge", () => {
    expect(dayLabel("upcoming", null, 14, "2026-11-01")).toBe("Започва на 1 ное");
    expect(dayLabel("upcoming", null, 7, "2026-12-24")).toBe("Започва на 24 дек");
  });

  it("says an ended challenge is over", () => {
    expect(dayLabel("ended", null, 14, "2026-11-01")).toBe("Приключи");
  });

  it("falls back to the length when a running challenge has no day", () => {
    expect(dayLabel("running", null, 14, "2026-11-01")).toBe("14 дни");
  });
});

describe("dayCount", () => {
  it("uses the Bulgarian singular for one day", () => {
    expect(dayCount(1)).toBe("1 ден");
    expect(dayCount(2)).toBe("2 дни");
    expect(dayCount(14)).toBe("14 дни");
  });
});

describe("progressLabel", () => {
  it("writes ticked out of counted days", () => {
    expect(progressLabel({ done: 3, total: 14 })).toBe("3 от 14 дни");
    expect(progressLabel({ done: 1, total: 1 })).toBe("1 от 1 ден");
  });
});

describe("challengeShareText", () => {
  it("carries the title and the day count only", () => {
    expect(challengeShareText("Първите 14 дни", 14)).toBe(
      "Завърших предизвикателството „Първите 14 дни“ · 14 дни",
    );
  });
});

describe("POINTS_TOAST", () => {
  it("is the verbatim points line", () => {
    expect(POINTS_TOAST).toBe("+5 точки");
  });
});

describe("boardNote", () => {
  it("explains the hidden state of her own row", () => {
    expect(boardNote(false)).toBe("Другите те виждат като „Участничка“.");
    expect(boardNote(true)).toBe("Името ти се показва като първо име и инициал.");
  });
});

describe("participantsLabel", () => {
  it("agrees with the number", () => {
    expect(participantsLabel(0)).toBe("Още няма участнички");
    expect(participantsLabel(1)).toBe("1 участничка");
    expect(participantsLabel(12)).toBe("12 участнички");
  });
});

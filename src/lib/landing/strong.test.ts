import { describe, expect, it } from "vitest";
import { ENROLMENT_CLOSES_AT, countdown, levelView, painMessage, seatsLeft } from "./strong";

describe("countdown", () => {
  it("counts days, hours and minutes to the close in Sofia time", () => {
    // 21.11.2026 23:59 in Sofia (UTC+2) is 21:59 UTC.
    expect(ENROLMENT_CLOSES_AT).toBe(Date.UTC(2026, 10, 21, 21, 59, 0));
    const now = ENROLMENT_CLOSES_AT - (3 * 86_400_000 + 4 * 3_600_000 + 5 * 60_000 + 30_000);
    expect(countdown(now)).toEqual({
      open: true,
      days: 3,
      hours: "04",
      minutes: "05",
      strip: "Записването затваря след 3 дни и 4 ч",
    });
  });

  it("uses the singular for one day", () => {
    expect(countdown(ENROLMENT_CLOSES_AT - 86_400_000 - 60_000).strip).toBe(
      "Записването затваря след 1 ден и 0 ч",
    );
  });

  it("is closed at and after the deadline", () => {
    for (const now of [ENROLMENT_CLOSES_AT, ENROLMENT_CLOSES_AT + 1]) {
      expect(countdown(now)).toEqual({
        open: false,
        days: 0,
        hours: "00",
        minutes: "00",
        strip: "Записването е затворено",
      });
    }
  });
});

describe("painMessage", () => {
  it("answers how many of the four lines she picked", () => {
    expect(painMessage(0)).toMatch(/^Не ти липсва воля/);
    expect(painMessage(2)).toBe(
      "Позна се в 2 от 4. Не ти липсва воля, липсва ти план, който се побира в деня ти.",
    );
    expect(painMessage(4)).toMatch(/^И четирите\./);
  });
});

describe("levelView", () => {
  it("unlocks every reward at or below the chosen level", () => {
    const v = levelView(6);
    expect(v.rewards.map((r) => [r.level, r.unlocked])).toEqual([
      [4, true],
      [6, true],
      [8, false],
      [10, false],
    ]);
    expect(v.text).toBe("Отключваш: специалните нива с ексклузивни тренировки.");
  });

  it("explains the first reward below level 4", () => {
    expect(levelView(2).text).toBe("Влизаш, тренираш, трупаш точки. Първата награда е на ниво 4.");
    expect(levelView(2).rewards.every((r) => !r.unlocked)).toBe(true);
  });

  it("clamps the level to 1..10", () => {
    expect(levelView(0).level).toBe(1);
    expect(levelView(42).level).toBe(10);
    expect(levelView(Number.NaN).level).toBe(1);
  });
});

describe("seatsLeft", () => {
  it("stays within 0..50 and gives the bar width", () => {
    expect(seatsLeft(37)).toEqual({ left: 37, percent: 74 });
    expect(seatsLeft(-3)).toEqual({ left: 0, percent: 0 });
    expect(seatsLeft(99)).toEqual({ left: 50, percent: 100 });
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScheduleList } from "./schedule-list";

const session = (id: string, over: Partial<Record<string, unknown>> = {}) => ({
  id,
  title: "Кръгова тренировка",
  startsAt: "2026-11-03T16:00:00.000Z",
  durationMin: 60,
  capacity: 10,
  booked: 7,
  spotsLeft: 3,
  cancelled: false,
  ...over,
});

const render = (sessions: ReturnType<typeof session>[], bookedIds: string[] = []) =>
  renderToStaticMarkup(
    createElement(ScheduleList, { sessions, bookedIds, busyId: null, onBook: () => {} }),
  );

describe("ScheduleList", () => {
  it("groups by day and shows free spots in Sofia time", () => {
    const html = render([session("a")]);
    expect(html).toContain("Вторник, 3.11");
    expect(html).toContain("18:00");
    expect(html).toContain("Остават 3 места");
    expect(html).toContain("Запиши се");
  });

  it("says one spot in the singular", () => {
    expect(render([session("a", { spotsLeft: 1 })])).toContain("Остава 1 място");
  });

  it("shows a full training with a disabled button", () => {
    const html = render([session("a", { spotsLeft: 0, booked: 10 })]);
    expect(html).toContain("Няма места");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("marks a cancelled training", () => {
    expect(render([session("a", { cancelled: true })])).toContain("Отменена");
  });

  it("shows her own booking instead of the button", () => {
    const html = render([session("a")], ["a"]);
    expect(html).toContain("Записана си");
    expect(html).not.toContain("Запиши се");
  });
});

describe("ScheduleList dates", () => {
  it("puts a date tile on every training", () => {
    const html = render([session("a")]);
    expect(html).toContain(">3<");
    expect(html).toContain(">ное<");
    expect(html).toContain(">вт<");
    expect(html).toContain('aria-label="Вторник, 3.11, 18:00 · Кръгова тренировка"');
  });
});

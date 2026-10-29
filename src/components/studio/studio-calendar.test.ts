import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudioCalendar } from "./studio-calendar";

const session = (id: string, startsAt: string, spotsLeft = 3) => ({
  id,
  title: "Кръгова тренировка",
  startsAt,
  durationMin: 60,
  capacity: 10,
  booked: 10 - spotsLeft,
  spotsLeft,
  cancelled: false,
});

const render = (sessions: ReturnType<typeof session>[], bookedIds: string[] = []) =>
  renderToStaticMarkup(
    createElement(StudioCalendar, {
      sessions,
      bookedIds,
      busyId: null,
      onBook: () => {},
      today: "2026-11-02",
    }),
  );

describe("StudioCalendar", () => {
  it("shows the coming weeks and opens on the first day with trainings", () => {
    const html = render([session("a", "2026-11-03T16:00:00.000Z")]);
    expect(html).toContain("2.11 – 2.12");
    expect(html).toContain("Вторник, 3.11");
    expect(html).toContain("Остават 3 места");
  });

  it("labels each day for screen readers with its state", () => {
    const html = render([
      session("a", "2026-11-03T16:00:00.000Z"),
      session("b", "2026-11-05T16:00:00.000Z", 0),
    ]);
    expect(html).toContain('aria-label="3.11 · има места"');
    expect(html).toContain('aria-label="5.11 · пълно"');
  });

  it("marks the day she is booked for", () => {
    expect(render([session("a", "2026-11-03T16:00:00.000Z")], ["a"])).toContain(
      'aria-label="3.11 · записана си"',
    );
  });
});

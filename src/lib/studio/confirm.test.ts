import { describe, expect, it } from "vitest";
import { bookingSummary } from "./confirm";

const session = { title: "Събота сила", startsAt: "2026-11-07T08:00:00.000Z" }; // 10:00 Sofia
const card = { kind: "card8" as const, startsOn: "2026-11-01", endsOn: "2026-11-28", remaining: 5 };

describe("bookingSummary", () => {
  it("names the training and the card visit it takes", () => {
    expect(bookingSummary(session, card, new Date("2026-11-05T10:00:00Z"))).toEqual({
      when: "Събота, 7.11, 10:00 · Събота сила",
      payment: "Взема се 1 посещение от Карта 8 (остават 5).",
      late: false,
    });
  });
  it("says she pays on site when no card covers that day", () => {
    expect(bookingSummary(session, null, new Date("2026-11-05T10:00:00Z")).payment).toBe(
      "Без карта: плащаш 7 € на място.",
    );
    expect(
      bookingSummary(session, { ...card, endsOn: "2026-11-06" }, new Date("2026-11-05T10:00:00Z"))
        .payment,
    ).toBe("Без карта: плащаш 7 € на място.");
    expect(
      bookingSummary(session, { ...card, remaining: 0 }, new Date("2026-11-05T10:00:00Z")).payment,
    ).toBe("Без карта: плащаш 7 € на място.");
  });
  it("flags a booking inside the last 6 hours", () => {
    expect(bookingSummary(session, card, new Date("2026-11-07T03:00:00Z")).late).toBe(true);
  });
});

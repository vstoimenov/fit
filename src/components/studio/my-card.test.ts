import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MyCard } from "./my-card";

const card = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "c1",
  kind: "card8" as const,
  visits: 8,
  startsOn: "2026-10-30",
  endsOn: "2026-11-26",
  usedBefore: 0,
  adjusted: 0,
  booked: 3,
  remaining: 5,
  voided: false,
  createdAt: "2026-10-30T10:00:00Z",
  ...over,
});

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(
    createElement(MyCard, { adjustments: [], today: "2026-11-01", ...props } as never),
  );

describe("MyCard", () => {
  it("shows the card line", () => {
    expect(render({ card: card() })).toContain("Карта 8 · остават 5 посещения · валидна до 26.11");
  });

  it("explains visits moved over from the notebook", () => {
    expect(render({ card: card({ usedBefore: 5, remaining: 3 }) })).toContain(
      "Пренесени от тефтера: 5",
    );
  });

  it("warns when one visit is left", () => {
    expect(render({ card: card({ remaining: 1 }) })).toContain("Остава ти 1 посещение");
  });

  it("warns when the card ends within 3 days", () => {
    expect(render({ card: card({ endsOn: "2026-11-03" }) })).toContain("Картата ти изтича на 3.11");
  });

  it("lists corrections with their reason", () => {
    const html = render({
      card: card(),
      adjustments: [{ cardId: "c1", delta: -2, reason: "две пропуснати", createdAt: "2026-11-01" }],
    });
    expect(html).toContain("−2");
    expect(html).toContain("две пропуснати");
  });

  it("without a card explains the drop-in price", () => {
    expect(render({ card: null })).toContain("Еднократна тренировка: 7 € на място");
  });
});

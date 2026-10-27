import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageSkeleton } from "./page-skeleton";

describe("PageSkeleton", () => {
  it("is announced as busy and draws the requested number of card frames", () => {
    const html = renderToStaticMarkup(createElement(PageSkeleton, { cards: 4 }));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Зарежда се");
    expect(html.match(/data-skeleton-card/g)).toHaveLength(4);
  });

  it("defaults to three cards", () => {
    const html = renderToStaticMarkup(createElement(PageSkeleton));
    expect(html.match(/data-skeleton-card/g)).toHaveLength(3);
  });
});

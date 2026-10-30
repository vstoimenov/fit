import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./site-footer";

describe("SiteFooter", () => {
  it("logs in to the app by default", () => {
    const html = renderToStaticMarkup(
      createElement(SiteFooter, { instagramUrl: null, year: 2026 }),
    );
    expect(html).toContain('href="/login"');
  });
  it("can send „Вход“ back to the page she came from", () => {
    const html = renderToStaticMarkup(
      createElement(SiteFooter, { instagramUrl: null, year: 2026, loginHref: "/login?next=/zala" }),
    );
    expect(html).toContain('href="/login?next=/zala"');
  });
});

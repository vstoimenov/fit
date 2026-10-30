import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudioHeader } from "./studio-header";

describe("StudioHeader", () => {
  it("has only the logo and „Вход“ back to /zala, nothing from the online club", () => {
    const html = renderToStaticMarkup(createElement(StudioHeader, { signedIn: false }));
    expect(html).toContain('href="/login?next=/zala"');
    expect(html).toContain("Вход");
    expect(html).not.toContain("Цени");
    expect(html).not.toContain("Започни");
    expect(html).not.toContain('href="/"');
  });
  it("offers „Изход“ when she is signed in", () => {
    const html = renderToStaticMarkup(createElement(StudioHeader, { signedIn: true }));
    expect(html).toContain("Изход");
    expect(html).not.toContain(">Вход<");
  });
});

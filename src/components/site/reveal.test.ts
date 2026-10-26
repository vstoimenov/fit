import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Reveal } from "./reveal";

describe("Reveal", () => {
  it("renders the same markup for every visitor: a CSS animation, never an inline opacity", () => {
    const html = renderToStaticMarkup(createElement(Reveal, { delay: 0.08 }, "Силно тяло."));
    expect(html).toContain("animate-site-reveal");
    expect(html).toContain("motion-reduce:animate-none");
    expect(html).toContain("animation-delay:0.08s");
    expect(html).not.toMatch(/opacity/);
  });

  it("can render as an inline element so it is valid inside a heading", () => {
    const html = renderToStaticMarkup(createElement(Reveal, { as: "span" }, "x"));
    expect(html.startsWith("<span")).toBe(true);
  });
});

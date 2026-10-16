import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleBody } from "./article-body";

const render = (body: string) => renderToStaticMarkup(createElement(ArticleBody, { body }));

describe("ArticleBody", () => {
  it("renders headings, lists and paragraphs", () => {
    const html = render("## Заглавие\n\nТекст\n\n- едно\n- две");
    expect(html).toContain("<h2");
    expect(html).toContain("Заглавие");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>едно</li>");
  });

  it("never renders raw HTML: a script tag shows as text", () => {
    const html = render("Преди <script>alert(1)</script> след");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("does not turn a javascript: link into an anchor with that href", () => {
    const html = render("[x](javascript:alert(1))");
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toContain("javascript:alert");
    expect(html).toContain("x");
  });

  it("does not turn a data: link into an anchor with that href", () => {
    const html = render("[x](data:text/html;base64,PHNjcmlwdD4=)");
    expect(html).not.toMatch(/href="data:/i);
  });

  it("opens external https links safely in a new tab", () => {
    const html = render("[y](https://example.com)");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it("keeps internal links in the same tab", () => {
    const html = render("[z](/app/library)");
    expect(html).toContain('href="/app/library"');
    expect(html).not.toContain("target=");
  });

  it("renders https and /photos/ images lazily and drops any other source", () => {
    const https = render("![a](https://example.com/a.jpg)");
    expect(https).toContain('src="https://example.com/a.jpg"');
    expect(https).toContain('loading="lazy"');
    expect(render("![b](/photos/b.jpg)")).toContain('src="/photos/b.jpg"');
    expect(render("![c](http://example.com/c.jpg)")).not.toContain("<img");
    expect(render("![d](data:image/png;base64,AAAA)")).not.toContain("<img");
    expect(render("![e](//evil.test/e.jpg)")).not.toContain("<img");
  });
});

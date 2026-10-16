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

  it.each([
    ["vbscript:", "[x](vbscript:msgbox(1))"],
    ["mixed-case JaVaScRiPt:", "[x](JaVaScRiPt:alert(1))"],
    ["protocol-relative //", "[x](//evil.test/p)"],
    ["ftp:", "[x](ftp://example.com/f)"],
  ])("renders a %s link as plain text, not an anchor", (_label, md) => {
    const html = render(md);
    expect(html).not.toContain("<a ");
    expect(html).toContain("x");
  });

  it("allows mailto and anchor links", () => {
    expect(render("[m](mailto:a@b.co)")).toContain('href="mailto:a@b.co"');
    expect(render("[h](#top)")).toContain('href="#top"');
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
    expect(https).toMatch(/referrerpolicy="no-referrer"/i);
    expect(render("![b](/photos/b.jpg)")).toContain('src="/photos/b.jpg"');
    expect(render("![c](http://example.com/c.jpg)")).not.toContain("<img");
    expect(render("![d](data:image/png;base64,AAAA)")).not.toContain("<img");
    expect(render("![e](//evil.test/e.jpg)")).not.toContain("<img");
  });

  it("treats http:// links as external too", () => {
    const html = render("[h](http://example.com)");
    expect(html).toContain('href="http://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("tells screen readers that external links open in a new tab", () => {
    expect(render("[y](https://example.com)")).toContain("(отваря се в нов раздел)");
    expect(render("[z](/app/library)")).not.toContain("нов раздел");
  });

  it("styles h4-h6 like h3", () => {
    for (const hashes of ["####", "#####", "######"]) {
      const html = render(`${hashes} Под`);
      expect(html).toMatch(/<h[456] class="mb-2 mt-6 text-xl/);
    }
  });

  it("renders GFM tables, and autolinks a bare https URL as a safe external anchor", () => {
    const table = render("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(table).toContain("<table");
    expect(table).toMatch(/<td[^>]*>1<\/td>/);
    const link = render("Виж https://t.me/x днес");
    expect(link).toContain('href="https://t.me/x"');
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
  });

  it("leaves a bare javascript: text as text", () => {
    const html = render("javascript:alert(1) и <javascript:alert(1)>");
    expect(html).not.toContain("<a ");
    expect(html).not.toMatch(/href=/i);
  });
});

import { describe, expect, it } from "vitest";
import { FAQ, faqJsonLd } from "./faq";

describe("FAQ", () => {
  it("has eight questions with answers", () => {
    expect(FAQ).toHaveLength(8);
    for (const { q, a } of FAQ) {
      expect(q.endsWith("?")).toBe(true);
      expect(a.length).toBeGreaterThan(20);
    }
  });

  it("renders schema.org FAQPage JSON-LD", () => {
    const ld = faqJsonLd() as { "@type": string; mainEntity: unknown[] };
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(8);
  });
});

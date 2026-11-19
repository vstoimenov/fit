import { describe, expect, it } from "vitest";
import { FAQ } from "./faq";
import { clubJsonLd, homeDescription, homeFaq, llmsTxt, priceText, shortPrice } from "./seo";

const month = { interval: "month" as const, price_cents: 3900, currency: "EUR" };
const year = { interval: "year" as const, price_cents: 28080, currency: "EUR" };
const nbsp = (s: string) => s.replace(/ /g, " ");

describe("shortPrice / priceText", () => {
  it("drops decimals for whole euros and keeps them otherwise", () => {
    expect(nbsp(shortPrice(3900))).toBe("39 €");
    expect(nbsp(shortPrice(28080))).toBe("280,80 €");
  });

  it("names both base plans, or nothing while the plans are unknown", () => {
    expect(nbsp(priceText([month, year])!)).toBe("39 € на месец или 280,80 € за година");
    expect(nbsp(priceText([month])!)).toBe("39 € на месец");
    expect(priceText([])).toBeNull();
  });
});

describe("homeDescription", () => {
  it("says what, for whom, the price, the guarantee, the company and the city", () => {
    const d = nbsp(homeDescription([month, year]));
    expect(d).toContain("Онлайн клуб на български за тренировки у дома за жени 25–45 г.");
    expect(d).toContain("Абонамент 39 € на месец или 280,80 € за година, 14 дни гаранция.");
    expect(d).toContain("ПРОФИТБРАНД ЕООД, гр. Плевен.");
  });

  it("never prints an empty price", () => {
    expect(homeDescription([])).toContain("Месечен или годишен абонамент, 14 дни гаранция.");
  });
});

describe("homeFaq", () => {
  it("adds the price and the location after the fixed FAQ", () => {
    const faq = homeFaq([month, year]);
    expect(faq.slice(0, FAQ.length)).toEqual(FAQ);
    expect(faq.map((f) => f.q)).toContain("Колко струва?");
    expect(faq.at(-1)!.a).toContain("Плевен");
    expect(homeFaq([]).map((f) => f.q)).not.toContain("Колко струва?");
  });
});

describe("clubJsonLd", () => {
  it("describes the club in Pleven with Аксения and both base offers", () => {
    const ld = clubJsonLd({
      baseUrl: "https://iamstrong.bg",
      plans: [month, year],
      instagramUrl: null,
    }) as { "@graph": Record<string, unknown>[] };
    const [club, person] = ld["@graph"];
    expect(club).toMatchObject({
      "@id": "https://iamstrong.bg/#club",
      url: "https://iamstrong.bg/",
      email: "info@iamstrong.bg",
      address: { addressLocality: "Плевен", addressCountry: "BG" },
      founder: { "@id": "https://iamstrong.bg/#aksenia" },
    });
    expect(club).not.toHaveProperty("sameAs");
    expect(club!.makesOffer).toMatchObject([
      { price: "39.00", priceCurrency: "EUR", priceSpecification: { billingDuration: "P1M" } },
      { price: "280.80", priceCurrency: "EUR", priceSpecification: { billingDuration: "P1Y" } },
    ]);
    expect(person).toMatchObject({ "@type": "Person", name: "Аксения Михайлова" });
  });

  it("leaves offers out rather than publishing empty ones", () => {
    const ld = clubJsonLd({
      baseUrl: "https://iamstrong.bg/",
      plans: [],
      instagramUrl: "https://instagram.com/x",
    }) as {
      "@graph": Record<string, unknown>[];
    };
    expect(ld["@graph"][0]).not.toHaveProperty("makesOffer");
    expect(ld["@graph"][0]).toHaveProperty("sameAs", ["https://instagram.com/x"]);
  });
});

describe("llmsTxt", () => {
  it("is a markdown summary with prices, the 40% year discount and absolute links", () => {
    const txt = nbsp(llmsTxt({ baseUrl: "https://iamstrong.bg/", plans: [month, year] }));
    expect(txt.startsWith("# I AM STRONG\n")).toBe(true);
    expect(txt).toContain("39 € на месец или 280,80 € за година (годишният план е с 40% отстъпка");
    expect(txt).toContain("(https://iamstrong.bg/start)");
    expect(txt).toContain("### Колко струва?");
  });
});

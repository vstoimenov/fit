import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pricing, type LandingPlan } from "./pricing";

const month: LandingPlan = {
  id: "m",
  name: "Месечен",
  interval: "month",
  price_cents: 1990,
  currency: "EUR",
};
const year: LandingPlan = {
  id: "y",
  name: "Годишен",
  interval: "year",
  price_cents: 14900,
  currency: "EUR",
};

function html(plans: LandingPlan[] | null) {
  return renderToStaticMarkup(createElement(Pricing, { plans }));
}

describe("Pricing", () => {
  it("renders the fallback copy and the CTA when plans are unavailable", () => {
    for (const plans of [null, []]) {
      const out = html(plans);
      expect(out).toContain("Цената на плана ще видиш в приложението");
      expect(out).toContain('href="/start"');
      expect(out).toContain("Започни безплатно");
      expect(out).not.toContain("€");
    }
  });

  it("shows amounts and the best-value chip only when yearly really saves", () => {
    const out = html([month, year]);
    expect(out).toContain("19,90");
    expect(out).toContain("Най-изгодно");
    expect(html([month, { ...year, price_cents: 23880 }])).not.toContain("Най-изгодно");
    expect(html([year])).not.toContain("Най-изгодно");
  });
});

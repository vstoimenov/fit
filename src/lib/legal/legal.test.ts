import { describe, expect, it } from "vitest";
import { operatorLine, type LegalDoc } from "./doc";
import { PRIVACY } from "./privacy";
import { TERMS } from "./terms";

const text = (doc: LegalDoc) =>
  doc.sections
    .flatMap((s) => [s.heading, ...s.blocks.flatMap((b) => (typeof b === "string" ? [b] : b))])
    .join("\n");

describe("TERMS", () => {
  const t = text(TERMS);
  it("says the content is not medical advice and points to a doctor", () => {
    expect(t).toContain("не е медицински съвет");
    expect(t).toContain("лекар");
  });
  it("spells out the 14-day guarantee: 10 workouts in the first 14 days", () => {
    expect(t).toContain("10 от първите 14 дни");
  });
  it("keeps the consumer's 14-day right of withdrawal", () => {
    expect(t).toContain("14 дни");
    expect(t).toContain("отказ");
  });
  it("tells how to stop the subscription", () => {
    expect(t).toContain("подновява");
    expect(t).toContain("Профил");
  });
});

describe("PRIVACY", () => {
  const t = text(PRIVACY);
  it("names the explicit consent for health data", () => {
    expect(t).toContain("изрично съгласие");
  });
  it("discloses the AI food estimate sent to Anthropic in the USA", () => {
    expect(t).toContain("Anthropic");
    expect(t).toContain("САЩ");
  });
  it("lists the right to complain to the Bulgarian data protection authority", () => {
    expect(t).toContain("Комисията за защита на личните данни");
  });
  it("explains deleting and downloading her data from the profile", () => {
    expect(t).toContain("Изтрий профила ми");
    expect(t).toContain("Изтегли моите данни");
  });
});

describe("operatorLine", () => {
  it("names the company when its details are known", () => {
    expect(operatorLine({ name: "Фирма ЕООД", eik: "123456789", address: "София" })).toBe(
      "Фирма ЕООД, ЕИК 123456789, адрес: София",
    );
  });
  it("says plainly that the details are coming while they are missing", () => {
    expect(operatorLine({ name: "", eik: "", address: "" })).toContain(
      "преди старта на продажбите",
    );
  });
});

describe("in-person trainings", () => {
  it("TERMS has a section with the booking and 6-hour cancel rules", () => {
    const section = TERMS.sections.find((s) => s.heading === "9. Тренировки на място");
    expect(section).toBeDefined();
    expect(text({ ...TERMS, sections: [section!] })).toContain("6 часа");
    expect(TERMS.sections.map((s) => s.heading).at(-1)).toBe("16. Въпроси, жалби и спорове");
  });
  it("PRIVACY lists what is kept for in-person trainings", () => {
    const section = PRIVACY.sections.find((s) => s.heading === "2. Какви данни събираме");
    expect(text({ ...PRIVACY, sections: [section!] })).toContain("Тренировки на място");
  });
});

describe("gym map", () => {
  it("PRIVACY says the Google map loads only on request", () => {
    expect(text(PRIVACY)).toContain("Покажи картата");
  });
});

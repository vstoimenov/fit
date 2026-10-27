import { describe, expect, it } from "vitest";
import { amountLabel, formatAmount, parseSteps, stepIngredients } from "./recipe";

describe("parseSteps", () => {
  it("splits numbered lines into steps and keeps follow-up lines with their step", () => {
    expect(
      parseSteps("1. Загрей фурната.\n2. Смеси сухото.\nПо желание канела.\n3) Печи."),
    ).toEqual(["Загрей фурната.", "Смеси сухото.\nПо желание канела.", "Печи."]);
  });

  it("falls back to paragraphs, drops markdown marks and empty input", () => {
    expect(parseSteps("**Загрей** фурната.\n\n- Смеси сухото.")).toEqual([
      "Загрей фурната.",
      "Смеси сухото.",
    ]);
    expect(parseSteps("  \n ")).toEqual([]);
  });
});

describe("stepIngredients", () => {
  const ingredients = [
    { name: "Пълнозърнесто спелтово брашно", grams: 100 },
    { name: "Смлени ядки (бадеми)", grams: 50 },
    { name: "Овесени ядки", grams: 50 },
    { name: "Кокосово масло", grams: 30 },
    { name: "Банани", grams: 250 },
    { name: "Сол", grams: 3 },
  ];

  it("finds the ingredients a step talks about, by word stems", () => {
    expect(
      stepIngredients(
        "Смеси спелтовото брашно, овесените ядки, смлените ядки и солта.",
        ingredients,
      ),
    ).toEqual([0, 1, 2, 5]);
    expect(stepIngredients("Разтопи кокосовото масло и намачкай бананите.", ingredients)).toEqual([
      3, 4,
    ]);
  });

  it("does not confuse two ingredients that share one word", () => {
    expect(stepIngredients("Смели целите бадеми на смлени ядки.", ingredients)).toEqual([1]);
  });
});

describe("formatAmount and amountLabel", () => {
  it("writes halves, quarters and thirds the way a cook reads them", () => {
    expect(formatAmount(1.5)).toBe("1½");
    expect(formatAmount(0.5)).toBe("½");
    expect(formatAmount(0.25)).toBe("¼");
    expect(formatAmount(2.75)).toBe("2¾");
    expect(formatAmount(1 / 3)).toBe("⅓");
    expect(formatAmount(3)).toBe("3");
    expect(formatAmount(0.4)).toBe("0,4");
  });

  it("scales by portions: grams and ml rounded, spoons as fractions", () => {
    const flour = { name: "Брашно", grams: 100 };
    const powder = { name: "Бакпулвер", grams: 6, amount: 1.5, unit: "ч.л." as const };
    const milk = { name: "Мляко", grams: 50, amount: 50, unit: "мл" as const };
    expect(amountLabel(flour, 8, 8)).toBe("100 г");
    expect(amountLabel(flour, 4, 8)).toBe("50 г");
    expect(amountLabel(flour, 1, 8)).toBe("12,5 г");
    expect(amountLabel(powder, 8, 8)).toBe("1½ ч.л.");
    expect(amountLabel(powder, 16, 8)).toBe("3 ч.л.");
    expect(amountLabel(powder, 4, 8)).toBe("¾ ч.л.");
    expect(amountLabel(milk, 12, 8)).toBe("75 мл");
  });
});

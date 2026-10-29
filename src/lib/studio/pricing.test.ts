import { describe, expect, it } from "vitest";
import { cardAdvice, cardSavings, dropInAdvice, eur, perTraining } from "./pricing";

describe("price figures", () => {
  it("matches the price list", () => {
    expect(perTraining("card8")).toBe(6.25);
    expect(perTraining("card12")).toBe(5);
    expect(cardSavings("card8")).toBe(6);
    expect(cardSavings("card12")).toBe(24);
  });
  it("writes euros the Bulgarian way", () => {
    expect(eur(6.25)).toBe("6,25 €");
    expect(eur(5)).toBe("5 €");
  });
});

describe("cardAdvice", () => {
  it("says how long a card lasts and what she saves", () => {
    expect(cardAdvice("card8", 2)).toBe(
      "Стига ти за 4 седмици · 6,25 € на тренировка · спестяваш 6 €.",
    );
    expect(cardAdvice("card12", 3)).toBe(
      "Стига ти за 4 седмици · 5 € на тренировка · спестяваш 24 €.",
    );
    expect(cardAdvice("card8", 4)).toBe(
      "Стига ти за 2 седмици · 6,25 € на тренировка · спестяваш 6 €.",
    );
  });
  it("is honest when visits would expire unused", () => {
    expect(cardAdvice("card8", 1)).toBe(
      "За 4 седмици ще използваш 4 от 8 посещения, останалите изтичат.",
    );
    expect(cardAdvice("card12", 1)).toBe(
      "За 6 седмици ще използваш 6 от 12 посещения, останалите изтичат.",
    );
  });
});

describe("dropInAdvice", () => {
  it("fits someone who comes now and then", () => {
    expect(dropInAdvice(1)).toBe(
      "4 тренировки за 4 седмици = 28 €. Удобно, ако идваш от време на време.",
    );
  });
  it("points to the card that pays off", () => {
    expect(dropInAdvice(2)).toBe(
      "8 тренировки за 4 седмици = 56 €. С Карта 8 плащаш 50 € за 8 тренировки и спестяваш 6 €.",
    );
    expect(dropInAdvice(3)).toBe(
      "12 тренировки за 4 седмици = 84 €. С Карта 12 плащаш 60 € за 12 тренировки и спестяваш 24 €.",
    );
  });
});

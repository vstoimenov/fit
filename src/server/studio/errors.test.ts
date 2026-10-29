import { describe, expect, it } from "vitest";
import { studioErrorMessage } from "./errors";

describe("studioErrorMessage", () => {
  it.each([
    ["full", "Няма свободни места."],
    ["already booked", "Вече си записана за тази тренировка."],
    ["started", "Тренировката вече започна."],
    ["not open", "Записването отваря 14 дни преди тренировката."],
    ["session cancelled", "Тренировката е отменена."],
    ["too late", "Вече не може да се откаже — остават по-малко от 6 часа."],
    [
      "card in use",
      "От картата вече има записвания. Коригирай посещенията вместо да я анулираш.",
    ],
    ["negative", "Остатъкът не може да стане отрицателен."],
    ["invalid invite", "Поканата е невалидна или изтекла."],
  ])("maps %s", (reason, copy) => {
    expect(studioErrorMessage(reason)).toBe(copy);
  });

  it("falls back for anything else", () => {
    expect(studioErrorMessage("boom")).toBe("Нещо се обърка. Опитай отново.");
  });
});

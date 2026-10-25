import { describe, expect, it } from "vitest";
import { FIRST_14_DAYS } from "./template";

describe("FIRST_14_DAYS", () => {
  it("has one task per day for 14 days", () => {
    expect(FIRST_14_DAYS).toHaveLength(14);
  });

  it("uses the agreed task texts verbatim, day 1 to day 14", () => {
    expect(FIRST_14_DAYS).toEqual([
      "Направи първата си тренировка и се гордей.",
      "Изпий 8 чаши вода днес.",
      "10 минути разходка след обяд.",
      "Тренировка от програмата.",
      "Легни си 30 минути по-рано.",
      "5 минути стречинг преди сън.",
      "Отбележи седмицата в „Прогрес“.",
      "Тренировка от програмата.",
      "Хапни зеленчуци на всяко хранене.",
      "15 минути време само за теб.",
      "Тренировка от програмата.",
      "Без сладко след 18:00.",
      "Снимка на прогреса (за себе си).",
      "Последна тренировка — ти успя!",
    ]);
  });

  it("keeps every task within the 1..200 character bound", () => {
    for (const task of FIRST_14_DAYS) {
      expect(task.length).toBeGreaterThanOrEqual(1);
      expect(task.length).toBeLessThanOrEqual(200);
    }
  });
});

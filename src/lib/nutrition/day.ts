import type { EstimateItem } from "./schema";

export type Totals = { kcal: number; proteinG: number; carbsG: number; fatG: number };

export type DayResult = "in" | "under" | "over";

export const DAY_RESULT_LABEL: Record<DayResult, string> = {
  in: "В целта",
  under: "Под целта",
  over: "Над целта",
};

/** Sum of diary entries; kcal is whole, macros rounded to 0.1 g. */
export function sumEntries(entries: Totals[]): Totals {
  const sum = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    kcal: Math.round(sum.kcal),
    proteinG: roundTenth(sum.proteinG),
    carbsG: roundTenth(sum.carbsG),
    fatG: roundTenth(sum.fatG),
  };
}

/** In when within ±10 % of target, under below that, over above that. */
export function dayResult(totalKcal: number, targetKcal: number): DayResult {
  if (totalKcal * 10 < targetKcal * 9) return "under";
  if (totalKcal * 10 > targetKcal * 11) return "over";
  return "in";
}

/** Past days always show their result; today only from 20:00 Sofia; future days never. */
export function showDayResult(day: string, today: string, sofiaHour: number): boolean {
  if (day < today) return true;
  if (day === today) return sofiaHour >= 20;
  return false;
}

/** Scales an estimated item linearly to a new gram amount. */
export function rescale(item: EstimateItem, grams: number): EstimateItem {
  const factor = grams / item.grams;
  return {
    ...item,
    grams,
    kcal: Math.round(item.kcal * factor),
    proteinG: roundTenth(item.proteinG * factor),
    carbsG: roundTenth(item.carbsG * factor),
    fatG: roundTenth(item.fatG * factor),
  };
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

import type { EstimateItem } from "./schema";

export type Totals = { kcal: number; proteinG: number; carbsG: number; fatG: number };

export type DayResult = "in" | "under" | "over";

export const DAY_RESULT_LABEL: Record<DayResult, string> = {
  in: "В целта",
  under: "Под целта",
  over: "Над целта",
};

/** Powder/sand/ink only, never red: being over the target is information, not a failure. */
export const DAY_RESULT_STYLE: Record<DayResult, string> = {
  in: "bg-powder-chip text-rose-deep",
  under: "bg-sand text-ink",
  over: "bg-white text-ink ring-[1.5px] ring-inset ring-ink",
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

/**
 * Scales an estimated item linearly to a new gram amount.
 * Returns null when the amount is outside 1–2000 g, the item has no weight,
 * or the scaled kcal (> 5000) or a macro (> 1000) would not fit the diary.
 */
export function rescale(item: EstimateItem, grams: number): EstimateItem | null {
  if (!(grams >= 1 && grams <= 2000) || !(item.grams > 0)) return null;
  const scale = (value: number) => (value * grams) / item.grams;
  const kcal = Math.round(scale(item.kcal));
  const proteinG = roundTenth(scale(item.proteinG));
  const carbsG = roundTenth(scale(item.carbsG));
  const fatG = roundTenth(scale(item.fatG));
  if (kcal > 5000 || proteinG > 1000 || carbsG > 1000 || fatG > 1000) return null;
  return { ...item, grams, kcal, proteinG, carbsG, fatG };
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

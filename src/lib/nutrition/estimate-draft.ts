import { rescale, sumEntries, type Totals } from "./day";
import type { EstimateItem } from "./schema";

/** The live sum of the rows she is about to save. */
export function draftTotals(rows: EstimateItem[]): Totals {
  return sumEntries(rows);
}

/**
 * Sets the amount of one row; kcal and macros scale with it. Returns a new array. An amount the diary
 * cannot hold (outside 1–2000 g, or values over the database bounds) leaves that row as it was.
 *
 * Pass `base` (the rows as estimated) when the amount comes from typing: every keystroke is then scaled
 * from the original numbers, so the intermediate "1" and "15" on the way to "150" cannot add rounding
 * error. Without it the row itself is the starting point.
 */
export function applyGrams(
  rows: EstimateItem[],
  index: number,
  grams: number,
  base?: EstimateItem[],
): EstimateItem[] {
  const current = rows[index];
  if (!current) return [...rows];
  const scaled = rescale(base?.[index] ?? current, grams);
  return rows.map((row, i) => (i === index && scaled ? scaled : row));
}

/** „150“, „150,5“ and „150.5“ are amounts; anything else (empty, text, units) is not. */
export function parseGramsInput(raw: string): number | null {
  const text = raw.trim();
  return /^\d+([.,]\d+)?$/.test(text) ? Number(text.replace(",", ".")) : null;
}

/** Why the typed amount cannot be applied to this row, in words for the member; null when it can. */
export function gramsProblem(base: EstimateItem, raw: string): string | null {
  const grams = parseGramsInput(raw);
  if (grams === null || grams < 1 || grams > 2000) return "Количеството е между 1 и 2000 г.";
  return rescale(base, grams) ? null : "Това количество е твърде голямо.";
}

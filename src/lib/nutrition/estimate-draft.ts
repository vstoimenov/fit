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

const HALF_PORTION_MIN = 0.5;
const PORTIONS_MAX = 5;

/**
 * The − / + buttons next to an amount think in portions of the estimated serving, not grams:
 * half a portion per tap, between ½ and 5 portions, snapping an in-between amount to the next
 * half in the direction of the tap. Whole grams, so the field and the label agree.
 */
export function stepGrams(baseGrams: number, currentGrams: number, direction: 1 | -1): number {
  const portions = currentGrams / baseGrams;
  const next =
    direction === 1
      ? Math.floor(portions * 2 + 1e-9) / 2 + 0.5
      : Math.ceil(portions * 2 - 1e-9) / 2 - 0.5;
  const clamped = Math.min(PORTIONS_MAX, Math.max(HALF_PORTION_MIN, next));
  return Math.max(1, Math.round(clamped * baseGrams));
}

/** „½ порция“, „1 порция“, „1½ порции“ … or „≈ 0,8 порция“ for an amount between the halves. */
export function portionLabel(baseGrams: number, grams: number): string {
  const portions = grams / baseGrams;
  const halves = Math.round(portions * 2);
  const exact = Math.abs(portions * 2 - halves) < 0.02;
  if (exact) {
    const whole = Math.floor(halves / 2);
    const half = halves % 2 === 1;
    const number = whole === 0 ? "½" : half ? `${whole}½` : String(whole);
    const noun = whole === 0 || (whole === 1 && !half) ? "порция" : "порции";
    return `${number} ${noun}`;
  }
  const rounded = Math.round(portions * 10) / 10;
  const noun = rounded <= 1 ? "порция" : "порции";
  return `≈ ${rounded.toFixed(1).replace(".", ",")} ${noun}`;
}

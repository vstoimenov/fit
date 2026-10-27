/** The household measures a recipe may show next to the grams its nutrition is computed from. */
export const RECIPE_UNITS = ["г", "мл", "ч.л.", "с.л.", "ч.ч.", "бр.", "щипка"] as const;
export type RecipeUnit = (typeof RECIPE_UNITS)[number];

export type RecipeIngredient = { name: string; grams: number; amount?: number; unit?: RecipeUnit };

/** Markdown marks that should not show in the cooking view. */
function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)[*_](.+?)[*_](?=\s|$)/g, "$1$2")
    .replace(/^\s*[-*•]\s+/gm, "")
    .trim();
}

/**
 * The steps of a recipe, from the owner's text: lines starting with „1.“ or „1)“ open a step and
 * the lines under them belong to it; without numbers, each paragraph is a step.
 */
export function parseSteps(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const numbered = lines.some((l) => /^\s*\d+[.)]\s+/.test(l));
  if (numbered) {
    const steps: string[] = [];
    for (const line of lines) {
      const match = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (match) steps.push(match[1] ?? "");
      else if (steps.length > 0 && line.trim() !== "")
        steps[steps.length - 1] += `\n${line.trim()}`;
    }
    return steps.map(plain).filter(Boolean);
  }
  return text
    .split(/\n\s*\n/)
    .map(plain)
    .filter(Boolean);
}

const stem = (word: string) => word.toLowerCase().slice(0, 5);

/** Words that tell an ingredient apart: 3+ letters, outside brackets. */
function keyWords(name: string): string[] {
  return name
    .replace(/\(.*?\)/g, " ")
    .toLowerCase()
    .split(/[^a-zа-я]+/i)
    .filter((w) => w.length >= 3);
}

/**
 * Which ingredients a step talks about (their indexes, in recipe order), so the cooking view can
 * show them under the step. An ingredient matches when at least two of its key words (or its only
 * one) appear in the step by stem: „смлени ядки“ and „овесени ядки“ stay apart.
 */
export function stepIngredients(step: string, ingredients: readonly RecipeIngredient[]): number[] {
  const words = step
    .toLowerCase()
    .split(/[^a-zа-я]+/i)
    .filter((w) => w.length >= 3);
  // A key word is in the step when a step word starts with its stem („сол“ → „солта“).
  const inStep = (key: string) => words.some((w) => w.startsWith(stem(key)));
  const out: number[] = [];
  ingredients.forEach((ingredient, index) => {
    const keys = keyWords(ingredient.name);
    if (keys.length === 0) return;
    const hits = keys.filter(inStep).length;
    if (hits >= Math.min(2, keys.length)) out.push(index);
  });
  return out;
}

const FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

/** „1½“, „¾“, „3“; a value that is no common fraction gets one decimal („0,4“). */
export function formatAmount(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const rest = value - whole;
  if (rest < 0.02) return String(whole);
  if (rest > 0.98) return String(whole + 1);
  const fraction = FRACTIONS.find(([v]) => Math.abs(rest - v) < 0.02);
  if (fraction) return `${whole > 0 ? whole : ""}${fraction[1]}`;
  return String(Math.round(value * 10) / 10).replace(".", ",");
}

/**
 * The amount to show for `portions` when the list is written for `servings`: the household
 * measure when there is one (spoons as fractions), otherwise grams. Grams and ml are whole numbers
 * from 20 up and keep one decimal below (a slice of a loaf may need 12,5 г).
 */
export function amountLabel(
  ingredient: RecipeIngredient,
  portions: number,
  servings: number,
): string {
  const scale = portions / servings;
  const metric = (n: number) =>
    n >= 20 ? String(Math.round(n)) : String(Math.round(n * 10) / 10).replace(".", ",");
  if (ingredient.amount !== undefined && ingredient.unit) {
    const value = ingredient.amount * scale;
    const shown =
      ingredient.unit === "г" || ingredient.unit === "мл" ? metric(value) : formatAmount(value);
    return `${shown} ${ingredient.unit}`;
  }
  return `${metric(ingredient.grams * scale)} г`;
}

/** Total minutes of a recipe, or null when neither time is set. */
export function totalMinutes(prepMin: number | null, cookMin: number | null): number | null {
  if (prepMin === null && cookMin === null) return null;
  return (prepMin ?? 0) + (cookMin ?? 0);
}

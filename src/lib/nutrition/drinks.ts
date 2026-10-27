/**
 * The quick list in „Напитки“: one tap logs one usual portion. Amounts are in ml (stored as grams,
 * 1 g per ml) with typical Bulgarian café and home portions; values are rounded reference numbers,
 * a guide rather than a label. Alcoholic drinks carry extra calories from alcohol (7 kcal per g),
 * which the three macros do not show.
 */
export type DrinkPreset = {
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  alcohol?: true;
};

export const DRINK_PRESETS: readonly DrinkPreset[] = [
  { name: "Кафе с мляко", grams: 200, kcal: 89, proteinG: 5, carbsG: 7, fatG: 4.5 },
  { name: "Капучино", grams: 180, kcal: 80, proteinG: 4.5, carbsG: 6.5, fatG: 4 },
  { name: "Еспресо", grams: 30, kcal: 2, proteinG: 0.1, carbsG: 0.3, fatG: 0 },
  { name: "Чай със захар", grams: 250, kcal: 20, proteinG: 0, carbsG: 5, fatG: 0 },
  { name: "Прясно мляко", grams: 250, kcal: 127, proteinG: 8.5, carbsG: 12, fatG: 5 },
  { name: "Айрян", grams: 250, kcal: 87, proteinG: 4.5, carbsG: 6, fatG: 5 },
  { name: "Портокалов фреш", grams: 250, kcal: 111, proteinG: 1.7, carbsG: 25, fatG: 0.5 },
  { name: "Смути", grams: 300, kcal: 181, proteinG: 3, carbsG: 40, fatG: 1 },
  { name: "Протеинов шейк", grams: 300, kcal: 121, proteinG: 24, carbsG: 3, fatG: 1.5 },
  { name: "Кола", grams: 330, kcal: 140, proteinG: 0, carbsG: 35, fatG: 0 },
  { name: "Кола зеро", grams: 330, kcal: 1, proteinG: 0, carbsG: 0, fatG: 0 },
  { name: "Енергийна напитка", grams: 250, kcal: 112, proteinG: 0, carbsG: 28, fatG: 0 },
  { name: "Бира", grams: 500, kcal: 215, proteinG: 2.5, carbsG: 18, fatG: 0, alcohol: true },
  { name: "Вино", grams: 150, kcal: 125, proteinG: 0.1, carbsG: 4, fatG: 0, alcohol: true },
];

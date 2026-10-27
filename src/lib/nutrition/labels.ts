export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;

export const DIETS = ["omnivore", "vegetarian", "vegan", "pescatarian"] as const;

export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active"] as const;

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
/** The diary groups: the four meals plus „Напитки“ (liquid calories on their own; not a menu meal). */
export const DIARY_SLOTS = [...MEAL_SLOTS, "drinks"] as const;

export type Allergen = (typeof ALLERGENS)[number];
export type Diet = (typeof DIETS)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type MealSlot = (typeof MEAL_SLOTS)[number];
export type DiarySlot = (typeof DIARY_SLOTS)[number];

/** Bulgarian labels for allergen codes. */
export const ALLERGEN_LABEL: Record<Allergen, string> = {
  gluten: "Глутен",
  crustaceans: "Ракообразни",
  eggs: "Яйца",
  fish: "Риба",
  peanuts: "Фъстъци",
  soy: "Соя",
  milk: "Мляко и лактоза",
  nuts: "Ядки",
  celery: "Целина",
  mustard: "Синап",
  sesame: "Сусам",
  sulphites: "Сулфити",
  lupin: "Лупина",
  molluscs: "Мекотели",
};

/** Bulgarian labels for diet codes. */
export const DIET_LABEL: Record<Diet, string> = {
  omnivore: "Ям всичко",
  vegetarian: "Вегетарианка",
  vegan: "Веган",
  pescatarian: "Пескетарианка",
};

/** Bulgarian labels for activity codes. */
export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Седя през повечето време",
  light: "Малко движение",
  moderate: "Движа се доста",
  active: "Много активна",
};

/** Bulgarian labels for meal slots. */
export const MEAL_LABEL: Record<MealSlot, string> = {
  breakfast: "Закуска",
  lunch: "Обяд",
  dinner: "Вечеря",
  snack: "Междинно",
};

/** Bulgarian labels for the diary groups. */
export const DIARY_LABEL: Record<DiarySlot, string> = { ...MEAL_LABEL, drinks: "Напитки" };

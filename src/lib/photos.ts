import { FOCUS } from "@/lib/labels";

export type Photo = { src: string; alt: string };

export const PHOTOS = {
  hero: { src: "/photos/hero.jpg", alt: "Жена се разтяга на постелка у дома" },
  step1: { src: "/photos/step-1.jpg", alt: "Гири и шейк върху постелка за йога" },
  step2: { src: "/photos/step-2.jpg", alt: "Две жени си дават пет по време на планк" },
  step3: { src: "/photos/step-3.jpg", alt: "Жена прави клек на постелка у дома" },
  welcome: { src: "/photos/welcome.jpg", alt: "Жена с разперени ръце при изгрев край морето" },
} as const satisfies Record<string, Photo>;

const FOCUS_ALT: Record<(typeof FOCUS)[number], string> = {
  full_body: "Тренировка за цяло тяло",
  core: "Тренировка за корем",
  glutes_legs: "Тренировка за дупе и крака",
  upper: "Тренировка за горна част",
  stretch: "Стречинг у дома",
  cardio: "Кардио тренировка",
};

const DEFAULT_PHOTO: Photo = { src: "/photos/default.jpg", alt: "Тренировка" };

function isFocus(value: string): value is (typeof FOCUS)[number] {
  return (FOCUS as readonly string[]).includes(value);
}

/** Cover photo for a workout focus; unknown or missing focus gets the default. */
export function coverPhoto(focus: string | null | undefined): Photo {
  if (!focus || !isFocus(focus)) return DEFAULT_PHOTO;
  return { src: `/photos/focus-${focus}.jpg`, alt: FOCUS_ALT[focus] };
}

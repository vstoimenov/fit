import type { Level } from "@/lib/program/types";

export const GOALS = ["lose_weight", "tone", "strength", "energy"] as const;
export const PROBLEMS = [
  "belly",
  "glutes_thighs",
  "arms",
  "back_posture",
  "postpartum",
  "motivation",
] as const;
export const EXPERIENCE = ["never", "sometimes", "regular"] as const;
export const TIMES = ["15", "20-30", "40+"] as const;
export const FOCUS = ["full_body", "core", "glutes_legs", "upper", "stretch", "cardio"] as const;

export type Goal = (typeof GOALS)[number];
export type Problem = (typeof PROBLEMS)[number];
export type Experience = (typeof EXPERIENCE)[number];
export type Time = (typeof TIMES)[number];
export type Focus = (typeof FOCUS)[number];

export const GOAL_LABEL: Record<Goal, string> = {
  lose_weight: "Да сваля килограми",
  tone: "Да стегна тялото",
  strength: "Да стана по-силна",
  energy: "Повече енергия, по-малко стрес",
};

export const PROBLEM_LABEL: Record<Problem, string> = {
  belly: "Коремът",
  glutes_thighs: "Дупе и бедра",
  arms: "Ръцете",
  back_posture: "Гръб и стойка",
  postpartum: "Възстановяване след раждане",
  motivation: "Не мога да съм постоянна",
};

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  never: "Почти не съм тренирала",
  sometimes: "Тренирам от време на време",
  regular: "Тренирам редовно",
};

export const TIME_LABEL: Record<Time, string> = {
  "15": "До 15 минути",
  "20-30": "20–30 минути",
  "40+": "40+ минути",
};

export const FOCUS_LABEL: Record<Focus, string> = {
  full_body: "Цяло тяло",
  core: "Корем",
  glutes_legs: "Дупе и крака",
  upper: "Горна част",
  stretch: "Стречинг",
  cardio: "Кардио",
};

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Начинаещ",
  advanced: "Напреднал",
  pro: "Профи",
};

export const FEELING_LABEL = { easy: "Лесно", right: "Точно", hard: "Трудно" } as const;

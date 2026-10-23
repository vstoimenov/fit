import type { Goal } from "@/lib/labels";
import type { ActivityLevel } from "./labels";

export type TargetInput = {
  weightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  activity: ActivityLevel | null;
  goal: Goal | null;
  /** YYYY-MM-DD in Europe/Sofia. */
  today: string;
};

/** Daily target in kcal and whole grams of macros. */
export type Target = { kcal: number; proteinG: number; carbsG: number; fatG: number };

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const MIN_KCAL = 1200;

/** Mifflin-St Jeor (female) daily target with activity, deficit, floor and macro split. Null if data is missing. */
export function calorieTarget(input: TargetInput): Target | null {
  const { weightKg, heightCm, birthYear, activity, goal, today } = input;
  if (weightKg === null || heightCm === null || birthYear === null || activity === null) {
    return null;
  }

  const age = Number(today.slice(0, 4)) - birthYear;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  const maintenance = bmr * ACTIVITY_FACTOR[activity];
  const deficit = goal === "lose_weight" && age >= 18 ? 0.85 : 1;
  const kcal = Math.max(MIN_KCAL, roundTo10(maintenance * deficit));

  const proteinG = Math.round(Math.min(1.6 * weightKg, (kcal * 0.3) / 4));
  const fatG = Math.round((kcal * 0.3) / 9);
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));

  return { kcal, proteinG, carbsG, fatG };
}

function roundTo10(value: number): number {
  return Math.round(value / 10) * 10;
}

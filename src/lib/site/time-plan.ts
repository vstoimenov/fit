export type WorkoutLength = "short" | "mid" | "long";

export type TimePlan = {
  /** The inputs after clamping (10–40 in steps of 5; 2–6 days). */
  minutes: number;
  days: number;
  weeklyMinutes: number;
  workoutsPer30Days: number;
  /** Matches the library's length filter. */
  length: WorkoutLength;
  lengthLabel: "кратки" | "средни" | "дълги";
  levelLabel: string;
};

export const MINUTES = { min: 10, max: 40, step: 5, start: 20 } as const;
export const DAYS = { min: 2, max: 6, start: 4 } as const;

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/** The „Колко време имаш?" calculator: honest arithmetic only, no promises about results. */
export function timePlan(minutesInput: number, daysInput: number): TimePlan {
  const minutes = clamp(
    Math.round(clamp(minutesInput, MINUTES.min, MINUTES.max, MINUTES.start) / MINUTES.step) *
      MINUTES.step,
    MINUTES.min,
    MINUTES.max,
    MINUTES.start,
  );
  const days = Math.round(clamp(daysInput, DAYS.min, DAYS.max, DAYS.start));

  const length: WorkoutLength = minutes <= 15 ? "short" : minutes <= 25 ? "mid" : "long";
  const lengthLabel = length === "short" ? "кратки" : length === "mid" ? "средни" : "дълги";
  const levelLabel =
    days <= 3 ? "Начинаеща" : days <= 5 ? "Начинаеща → Напреднала след седмица 2" : "Напреднала";

  return {
    minutes,
    days,
    weeklyMinutes: minutes * days,
    workoutsPer30Days: Math.round((days * 30) / 7),
    length,
    lengthLabel,
    levelLabel,
  };
}

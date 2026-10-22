import { REWARDS, type LevelProgress } from "./levels";

/** What the server action reports after a completion (see `completeWorkout`). */
export interface CompletionPoints {
  total: number;
  level: number;
  /** What this completion added; 0 when the day's workout points were already taken. */
  gained: number;
  levelUp: boolean;
}

/** „Ниво 3 · 140 т.“ */
export function levelChipText(p: LevelProgress): string {
  return `Ниво ${p.level} · ${p.points} т.`;
}

/** „Още 50 точки до ниво 2 · {reward}“, or „Максимално ниво“ at the top. */
export function nextStepText(p: LevelProgress): string {
  if (p.nextLevel === null || p.toNext === null) return "Максимално ниво";
  const unit = p.toNext === 1 ? "точка" : "точки";
  const base = `Още ${p.toNext} ${unit} до ниво ${p.nextLevel}`;
  return p.nextReward ? `${base} · ${p.nextReward}` : base;
}

function isRewarded(level: number): level is keyof typeof REWARDS {
  return level in REWARDS;
}

/** Lines under the stats on the after-workout screen; empty when the points could not be read. */
export function afterWorkoutLines(points: CompletionPoints | null): string[] {
  if (!points) return [];
  const lines = [
    points.gained > 0
      ? `+${points.gained} точки · общо ${points.total}`
      : `Днешните точки вече са взети · общо ${points.total}`,
  ];
  if (points.levelUp) {
    const tail = isRewarded(points.level) ? REWARDS[points.level] : "Продължавай така.";
    lines.push(`Ниво ${points.level}! ${tail}`);
  }
  return lines;
}

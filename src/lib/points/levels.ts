/** Total points needed for each level; index 0 is level 1. Mirrors `public.level_for_points`. */
export const LEVEL_THRESHOLDS: readonly number[] = [
  0, 50, 120, 220, 350, 520, 730, 980, 1270, 1600,
];

export const REWARDS: Record<4 | 6 | 8 | 10, string> = {
  4: "20% отстъпка от следващия абонамент",
  6: "Ексклузивни тренировки",
  8: "Лична консултация с Аксения",
  10: "6 месеца клуб безплатно",
};

const REWARDED_LEVELS = [4, 6, 8, 10] as const;
const MAX_LEVEL = LEVEL_THRESHOLDS.length;

/** Level (1–10) for a points total. Zero, negative and non-finite totals are level 1. */
export function levelForPoints(points: number): number {
  if (!Number.isFinite(points)) return 1;
  let level = 1;
  for (let i = 1; i < MAX_LEVEL; i++) {
    if (points >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  points: number;
  nextLevel: number | null;
  toNext: number | null;
  /** 0–100 within the current level band; 100 at the top level. */
  percent: number;
  /** Reward of the first rewarded level (4/6/8/10) at or above `nextLevel`. */
  nextReward: string | null;
}

export function levelProgress(rawPoints: number): LevelProgress {
  // NaN and ±Infinity can't be placed in a band: they count as no points at all.
  const points = Number.isFinite(rawPoints) ? rawPoints : 0;
  const level = levelForPoints(points);
  if (level >= MAX_LEVEL) {
    return { level, points, nextLevel: null, toNext: null, percent: 100, nextReward: null };
  }
  const nextLevel = level + 1;
  const from = LEVEL_THRESHOLDS[level - 1];
  const to = LEVEL_THRESHOLDS[level];
  const effective = Math.max(points, 0);
  const percent = Math.min(100, Math.max(0, Math.round(((effective - from) / (to - from)) * 100)));
  const rewarded = REWARDED_LEVELS.find((l) => l >= nextLevel);
  return {
    level,
    points,
    nextLevel,
    toNext: to - effective,
    percent,
    nextReward: rewarded === undefined ? null : REWARDS[rewarded],
  };
}

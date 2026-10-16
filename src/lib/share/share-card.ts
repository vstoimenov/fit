/**
 * The only data a share image or share text may carry. Built by whitelisting, so a wider
 * input (profile, check-in, questionnaire) can never leak weight, measurements, goals,
 * problems, timezone or e-mail into something she posts publicly.
 */
export interface ShareCard {
  workoutTitle: string;
  streakDays: number;
  weekDone: number;
  weekTarget: number;
}

const MAX_TITLE = 60;

function int(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function title(value: unknown): string {
  if (typeof value !== "string") return "";
  const t = value.trim();
  return t.length <= MAX_TITLE ? t : `${t.slice(0, MAX_TITLE - 1).trimEnd()}…`;
}

export function toShareCard(input: Record<string, unknown>): ShareCard {
  const weekTarget = int(input.weekTarget, 1, 7, 1);
  return {
    workoutTitle: title(input.workoutTitle),
    streakDays: int(input.streakDays, 0, Number.MAX_SAFE_INTEGER, 0),
    weekDone: int(input.weekDone, 0, weekTarget, 0),
    weekTarget,
  };
}

export function streakPhrase(days: number): string {
  return days === 1 ? "1 ден поред" : `${days} дни поред`;
}

/** „Цяло тяло · 4 дни поред · 3/5 тази седмица"; the streak is left out at 0. */
export function shareText(card: ShareCard): string {
  return [
    card.workoutTitle,
    card.streakDays > 0 ? streakPhrase(card.streakDays) : null,
    `${card.weekDone}/${card.weekTarget} тази седмица`,
  ]
    .filter(Boolean)
    .join(" · ");
}

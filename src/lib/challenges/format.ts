import { formatChallengeDate } from "./calendar";

/** The line shown for 5 seconds after a first tick earns points. */
export const POINTS_TOAST = "+5 точки";

/** „1 ден“ / „14 дни“. */
export function dayCount(days: number): string {
  return days === 1 ? "1 ден" : `${days} дни`;
}

/** „Ден 3 от 14“ while running, „Започва на 1 ное“ before the start, „Приключи“ after the end. */
export function dayLabel(
  status: "upcoming" | "running" | "ended",
  day: number | null,
  days: number,
  startDate: string,
): string {
  if (status === "upcoming") return `Започва на ${formatChallengeDate(startDate)}`;
  if (status === "ended") return "Приключи";
  return day === null ? dayCount(days) : `Ден ${day} от ${days}`;
}

/** „3 от 14 дни“: ticked days out of the days she is counted for. */
export function progressLabel(progress: { done: number; total: number }): string {
  return `${progress.done} от ${dayCount(progress.total)}`;
}

/** What she posts: the title and the day count, nothing else about her. */
export function challengeShareText(title: string, days: number): string {
  return `Завърших предизвикателството „${title}“ · ${dayCount(days)}`;
}

/** The small line under the board switch. */
export function boardNote(show: boolean): string {
  return show
    ? "Името ти се показва като първо име и инициал."
    : "Другите те виждат като „Участничка“.";
}

/** „12 участнички“; the list card shows it next to the day label. */
export function participantsLabel(count: number): string {
  if (count <= 0) return "Още няма участнички";
  return count === 1 ? "1 участничка" : `${count} участнички`;
}

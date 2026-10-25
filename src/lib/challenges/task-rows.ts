import { FIRST_14_DAYS } from "./template";

/** One editable day row in the admin form. `workoutId` is "" for no workout. */
export interface TaskRow {
  key: string;
  task: string;
  workoutId: string;
}

const MIN_DAYS = 3;
const MAX_DAYS = 60;

/** The day count typed in the form, or null while it is not a whole number between 3 and 60. */
export function parseDays(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= MIN_DAYS && n <= MAX_DAYS ? n : null;
}

/**
 * Rows for a day count. Rows are never removed: the form shows `rows.slice(0, days)` and a row that
 * falls beyond the count stays here with its text, so growing the count again brings it back.
 */
export function growRows(rows: TaskRow[], days: number, newKey: () => string): TaskRow[] {
  if (rows.length >= days) return rows;
  return [
    ...rows,
    ...Array.from({ length: days - rows.length }, () => ({
      key: newKey(),
      task: "",
      workoutId: "",
    })),
  ];
}

/** The „Първите 14 дни“ tasks on days 1-14; a workout already chosen for a day is kept, later rows stay. */
export function templateRows(rows: TaskRow[], newKey: () => string): TaskRow[] {
  const filled = growRows(rows, FIRST_14_DAYS.length, newKey);
  return filled.map((row, i) =>
    i < FIRST_14_DAYS.length ? { ...row, task: FIRST_14_DAYS[i] } : row,
  );
}

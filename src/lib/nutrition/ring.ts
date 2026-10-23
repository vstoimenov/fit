/**
 * Dash values for a progress ring drawn with a real circumference. `pathLength` on a <circle> is not
 * honoured by every engine (Safari), so the dash is sized in actual user units. Offset equals the
 * circumference when empty and 0 when full.
 */
export function ringDash(
  total: number,
  target: number | null,
  radius: number,
): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * radius;
  const ratio = target && target > 0 && total > 0 ? Math.min(1, total / target) : 0;
  return { circumference, offset: circumference * (1 - ratio) };
}

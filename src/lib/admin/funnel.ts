/** Share of `from` that reached `to`, as a label. Over 100% (tracking gaps) shows "100%+"; no base shows "—". */
export function stepRate(from: number, to: number): string {
  if (!(from > 0)) return "—";
  if (to > from) return "100%+";
  return `${Math.round((to / from) * 100)}%`;
}

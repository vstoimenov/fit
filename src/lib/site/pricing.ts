/** What the yearly plan saves against twelve monthly payments; null when it does not save. */
export function yearlySavings(
  monthCents: number | undefined,
  yearCents: number | undefined,
): { perMonthCents: number; savesCents: number } | null {
  if (monthCents === undefined || yearCents === undefined) return null;
  const savesCents = monthCents * 12 - yearCents;
  if (savesCents <= 0) return null;
  return { perMonthCents: Math.round(yearCents / 12), savesCents };
}

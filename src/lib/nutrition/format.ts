/** 1340 -> "1 340" (non-breaking space, so a number never wraps in the middle). */
export function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Macros are shown to the gram; kcal come as whole numbers already. */
export function formatGrams(value: number): string {
  return `${formatNumber(value)} г`;
}

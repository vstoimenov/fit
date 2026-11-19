/**
 * Gift voucher options shown on /podari, at the base prices (€39 / month; the year at 40% off).
 * The 12-month voucher shows twelve monthly payments struck through.
 */
export const GIFT_OPTIONS = [
  { months: 1, priceCents: 3900 },
  { months: 3, priceCents: 11700 },
  { months: 12, priceCents: 28080, regularCents: 46800 },
] as const;

export type GiftOption = (typeof GIFT_OPTIONS)[number];

export function giftMonthsLabel(months: number): string {
  return months === 1 ? "1 месец" : `${months} месеца`;
}

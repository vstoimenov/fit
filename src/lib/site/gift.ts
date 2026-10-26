/** Gift voucher options shown on /podari. Purchase itself is a later sub-project. */
export const GIFT_OPTIONS = [
  { months: 1, priceCents: 2900 },
  { months: 3, priceCents: 7900, regularCents: 8700 },
  { months: 12, priceCents: 25700 },
] as const;

export type GiftOption = (typeof GIFT_OPTIONS)[number];

export function giftMonthsLabel(months: number): string {
  return months === 1 ? "1 месец" : `${months} месеца`;
}

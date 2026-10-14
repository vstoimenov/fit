export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency }).format(cents / 100);
}

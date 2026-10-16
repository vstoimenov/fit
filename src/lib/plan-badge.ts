type PricedPlan = { interval: "month" | "year"; price_cents: number };

/** True when a yearly plan really costs less than twelve months of the monthly one. */
export function yearlyIsBestValue(plans: readonly PricedPlan[]): boolean {
  const monthly = plans.find((p) => p.interval === "month");
  const yearly = plans.find((p) => p.interval === "year");
  if (!monthly || !yearly) return false;
  return yearly.price_cents < monthly.price_cents * 12;
}

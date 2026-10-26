type PlanLike = { interval: "month" | "year" };

/** The plan for the chosen period; when it does not exist, whichever plan does. */
export function pickPlan<P extends PlanLike>(
  plans: readonly P[],
  interval: "month" | "year",
): P | undefined {
  const other = interval === "month" ? "year" : "month";
  return plans.find((p) => p.interval === interval) ?? plans.find((p) => p.interval === other);
}

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

const PERIODS = ["month", "year"] as const;
export type PricingPeriod = (typeof PERIODS)[number];

/** Keyboard step inside the period radio group (arrows wrap, Home/End jump); null for other keys. */
export function nextPeriod(current: PricingPeriod, key: string): PricingPeriod | null {
  const i = PERIODS.indexOf(current);
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return PERIODS[(i + 1) % PERIODS.length]!;
    case "ArrowLeft":
    case "ArrowUp":
      return PERIODS[(i - 1 + PERIODS.length) % PERIODS.length]!;
    case "Home":
      return PERIODS[0];
    case "End":
      return PERIODS[PERIODS.length - 1]!;
    default:
      return null;
  }
}

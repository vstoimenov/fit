export type RiskReason = "inactive" | "low_completion" | "no_first_workout" | "past_due";

export const RISK_LABEL: Record<RiskReason, string> = {
  inactive: "Не тренира",
  low_completion: "Под нормата",
  no_first_workout: "Платила, без тренировка",
  past_due: "Неуспешно плащане",
};

export interface RiskThresholds {
  inactiveDays: number;
  minCompletionPct: number;
}

export interface RiskInput {
  hasAccess: boolean;
  subStatus: string | null;
  joinedAt: string;
  lastDoneAt: string | null;
  published14: number;
  doneRegular14: number;
  paidWithoutWorkout: boolean;
  snoozedUntil: string | null;
}

export function completionPct(done: number, published: number): number | null {
  return published > 0 ? Math.round((done / published) * 100) : null;
}

/** Why a client needs a nudge (spec §6 "Изостават"). Leads without access only count for failed payments. */
export function assessRisk(c: RiskInput, t: RiskThresholds, now: Date): RiskReason[] {
  if (c.snoozedUntil && Date.parse(c.snoozedUntil) > now.getTime()) return [];
  const reasons: RiskReason[] = [];
  if (c.hasAccess) {
    const since = Date.parse(c.lastDoneAt ?? c.joinedAt);
    if (now.getTime() - since >= t.inactiveDays * 86_400_000) reasons.push("inactive");
    const pct = completionPct(c.doneRegular14, c.published14);
    if (c.published14 >= 2 && pct !== null && pct < t.minCompletionPct)
      reasons.push("low_completion");
    if (c.paidWithoutWorkout) reasons.push("no_first_workout");
  }
  if (c.subStatus === "past_due") reasons.push("past_due");
  return reasons;
}

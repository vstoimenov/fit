export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "none";
export type PaidProvider = "stripe" | "revolut";

/** What every provider's webhook is turned into before it touches our database. */
export interface NormalizedSubscriptionEvent {
  provider: PaidProvider;
  eventId: string;
  type: string;
  occurredAt: string;
  userId: string | null;
  customerId: string | null;
  subscriptionId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** When the subscription actually ended (not when cancellation was requested). */
  canceledAt: string | null;
  priceId: string | null;
  priceCents: number | null;
  interval: "month" | "year" | null;
}

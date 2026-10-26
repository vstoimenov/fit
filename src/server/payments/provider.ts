import type { GiftPurchase } from "@/server/gift/purchase";
import type { NormalizedSubscriptionEvent, PaidProvider } from "@/lib/payments/types";

export class ProviderUnavailableError extends Error {
  constructor(provider: string) {
    super(`${provider} payments are not configured`);
    this.name = "ProviderUnavailableError";
  }
}

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export interface CheckoutInput {
  userId: string;
  email: string;
  customerId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface GiftCheckoutInput {
  months: number;
  amountCents: number;
  currency: string;
  productName: string;
  buyerEmail: string;
  recipientName: string | null;
  message: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface ParsedWebhook {
  event: NormalizedSubscriptionEvent | null;
  /** A paid gift voucher session, when the event is one. */
  gift?: GiftPurchase | null;
  eventId: string;
  type: string;
  payload: unknown;
}

export interface PaymentProvider {
  readonly name: PaidProvider;
  readonly ready: boolean;
  createCheckout(input: CheckoutInput): Promise<{ url: string }>;
  /** One-time payment for a gift voucher; the voucher itself is created by the webhook. */
  createGiftCheckout(input: GiftCheckoutInput): Promise<{ url: string }>;
  createPortal(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  cancelNow(subscriptionId: string): Promise<void>;
  /** Throws WebhookSignatureError on a bad signature; any other throw means "try again later". */
  parseWebhook(rawBody: string, headers: Headers): Promise<ParsedWebhook>;
}

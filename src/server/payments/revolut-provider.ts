import { ProviderUnavailableError, WebhookSignatureError, type PaymentProvider } from "./provider";

/**
 * Placeholder until a Revolut Business merchant sandbox exists: the Merchant API subscription
 * flow and webhook event names must be verified against the live docs before implementing.
 */
export function createRevolutProvider(): PaymentProvider {
  const unavailable = async (): Promise<never> => {
    throw new ProviderUnavailableError("revolut");
  };
  return {
    name: "revolut",
    ready: false,
    createCheckout: unavailable,
    createGiftCheckout: unavailable,
    createPortal: unavailable,
    cancelNow: unavailable,
    async parseWebhook() {
      throw new WebhookSignatureError("revolut webhooks are not enabled");
    },
  };
}

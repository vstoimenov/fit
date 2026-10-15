import type { TypedClient } from "@/server/db/types";
import type { PaymentProvider } from "./provider";
import { createRevolutProvider } from "./revolut-provider";
import { createStripeProvider } from "./stripe-provider";

export async function getActiveProvider(
  db: TypedClient,
  env: { STRIPE_SECRET_KEY?: string; STRIPE_WEBHOOK_SECRET?: string },
): Promise<PaymentProvider> {
  const { data, error } = await db.rpc("active_payment_provider");
  if (error) throw new Error(`load payment provider failed: ${error.message}`);
  return data === "revolut"
    ? createRevolutProvider()
    : createStripeProvider({
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      });
}

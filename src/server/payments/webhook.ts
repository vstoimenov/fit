import type { TypedClient } from "@/server/db/types";
import { applySubscriptionEvent, markPaymentEvent, recordPaymentEvent } from "./apply-event";
import { WebhookSignatureError, type ParsedWebhook, type PaymentProvider } from "./provider";

/** Verify → store once → apply → mark processed. A 500 makes the provider retry later. */
export async function handleWebhook(
  provider: PaymentProvider,
  rawBody: string,
  headers: Headers,
  admin: TypedClient,
): Promise<{ status: number; body: string }> {
  let parsed: ParsedWebhook;
  try {
    parsed = await provider.parseWebhook(rawBody, headers);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return { status: 400, body: "invalid signature" };
    // e.g. the provider could not be reached to read the current subscription: retry later.
    console.error(
      "payment webhook parse failed",
      error instanceof Error ? error.message : "unknown",
    );
    return { status: 500, body: "retry" };
  }
  try {
    const state = await recordPaymentEvent(admin, {
      provider: provider.name,
      eventId: parsed.eventId,
      type: parsed.type,
      userId: parsed.event?.userId ?? null,
      payload: parsed.payload,
    });
    if (state === "seen") return { status: 200, body: "duplicate" };
    if (!parsed.event) {
      await markPaymentEvent(admin, provider.name, parsed.eventId, null);
      return { status: 200, body: "ignored" };
    }
    const result = await applySubscriptionEvent(admin, parsed.event);
    await markPaymentEvent(
      admin,
      provider.name,
      parsed.eventId,
      result === "no_user" ? "no matching user" : null,
    );
    return { status: 200, body: result };
  } catch (error) {
    console.error(
      "payment webhook apply failed",
      parsed.eventId,
      error instanceof Error ? error.message : "unknown",
    );
    return { status: 500, body: "retry" };
  }
}

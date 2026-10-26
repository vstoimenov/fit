import "server-only";

import { z } from "zod";
import type { TypedClient } from "@/server/db/types";

/** The browser's `PushSubscription.toJSON()`; anything else it sends is ignored. */
export const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(64) }),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

/**
 * Stores a browser subscription for `userId`. Runs with the service role so an endpoint that
 * belonged to another account on the same device (she signed out, a friend signed in) simply
 * moves to the current member instead of failing on the unique endpoint.
 */
export async function saveSubscription(
  admin: TypedClient,
  userId: string,
  input: SubscriptionInput,
  userAgent: string | null,
): Promise<void> {
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      user_agent: userAgent?.slice(0, 256) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(`save push subscription failed: ${error.message}`);
}

/** Removes her own subscription for this endpoint (RLS scopes the delete). */
export async function removeSubscription(db: TypedClient, endpoint: string): Promise<void> {
  const { error } = await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw new Error(`remove push subscription failed: ${error.message}`);
}

export async function setPushHour(
  db: TypedClient,
  userId: string,
  hour: number | null,
): Promise<void> {
  const { error } = await db.from("profiles").update({ push_hour: hour }).eq("id", userId);
  if (error) throw new Error(`set push hour failed: ${error.message}`);
}

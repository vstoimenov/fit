import "server-only";

import { z } from "zod";
import type { TypedClient } from "@/server/db/types";

/** The push services browsers use; the server POSTs to the endpoint blindly, so nothing else. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /(^|\.)push\.samsungosp\.com$/,
];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

/** The browser's `PushSubscription.toJSON()`; anything else it sends is ignored. */
export const subscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine(isPushEndpoint, "Неразпознат push адрес"),
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
  await trimDevices(admin, userId);
}

const MAX_DEVICES = 10;

/** Keeps the newest devices only, so one account cannot pile up thousands of endpoints. */
async function trimDevices(admin: TypedClient, userId: string): Promise<void> {
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(MAX_DEVICES, MAX_DEVICES + 99);
  if (error || !data?.length) return;
  await admin
    .from("push_subscriptions")
    .delete()
    .in(
      "id",
      data.map((r) => r.id),
    );
}

/**
 * On a shared device the browser subscription may still belong to whoever signed in before. The
 * device moves to the current member only when the caller holds the subscription's auth secret
 * (only that browser has it), and a claim never creates a row: an endpoint learned elsewhere cannot
 * be taken, and unknown endpoints go through saveSubscription. Returns whether a row was claimed.
 */
export async function claimSubscription(
  admin: TypedClient,
  userId: string,
  input: SubscriptionInput,
): Promise<boolean> {
  const { data, error } = await admin
    .from("push_subscriptions")
    .update({ user_id: userId, p256dh: input.keys.p256dh, last_used_at: new Date().toISOString() })
    .eq("endpoint", input.endpoint)
    .eq("auth", input.keys.auth)
    .select("id");
  if (error) throw new Error(`claim push subscription failed: ${error.message}`);
  return data.length > 0;
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

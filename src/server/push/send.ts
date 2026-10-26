import "server-only";

import webpush from "web-push";
import type { ServerEnv } from "@/lib/env-schema";
import type { TypedClient } from "@/server/db/types";

export interface PushRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** App-relative link the notification opens; defaults to /app in the service worker. */
  url?: string;
}

/** One delivery attempt; rejects with `statusCode` 404/410 when the subscription is dead. */
export type PushTransport = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
) => Promise<unknown>;

export interface PushReport {
  /** Members who received it on at least one device. */
  users: number;
  delivered: number;
  pruned: number;
  failed: number;
}

const CONCURRENCY = 10;

function isGone(error: unknown): boolean {
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return status === 404 || status === 410;
}

/**
 * Delivers one payload to every subscription row; dead endpoints are handed to `prune` and never
 * counted as failures. Pure apart from the two callbacks, so it is unit-tested with fakes.
 */
export async function sendPush(
  rows: PushRow[],
  payload: PushPayload,
  transport: PushTransport,
  prune: (ids: string[]) => Promise<void>,
): Promise<PushReport> {
  const body = JSON.stringify(payload);
  const reached = new Set<string>();
  const gone: string[] = [];
  let delivered = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.all(
      rows.slice(i, i + CONCURRENCY).map(async (row) => {
        try {
          await transport(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            body,
          );
          delivered++;
          reached.add(row.user_id);
        } catch (error) {
          if (isGone(error)) gone.push(row.id);
          else {
            failed++;
            console.error("push failed", error instanceof Error ? error.message : error);
          }
        }
      }),
    );
  }
  if (gone.length) await prune(gone);
  return { users: reached.size, delivered, pruned: gone.length, failed };
}

/** The real transport, or null when the VAPID keys are not configured. */
export function webPushTransport(env: ServerEnv): PushTransport | null {
  if (!env.WEB_PUSH_PUBLIC_KEY || !env.WEB_PUSH_PRIVATE_KEY || !env.WEB_PUSH_SUBJECT) return null;
  const options = {
    vapidDetails: {
      subject: env.WEB_PUSH_SUBJECT,
      publicKey: env.WEB_PUSH_PUBLIC_KEY,
      privateKey: env.WEB_PUSH_PRIVATE_KEY,
    },
    TTL: 60 * 60 * 12,
  };
  return (subscription, payload) => webpush.sendNotification(subscription, payload, options);
}

/**
 * Sends to the given members (or every subscribed member with `"all"`) using the service role:
 * subscriptions are member-owned rows no other session may read.
 */
export async function sendToUsers(
  admin: TypedClient,
  userIds: string[] | "all",
  payload: PushPayload,
  transport: PushTransport,
): Promise<PushReport> {
  if (userIds !== "all" && userIds.length === 0) {
    return { users: 0, delivered: 0, pruned: 0, failed: 0 };
  }
  let query = admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  if (userIds !== "all") query = query.in("user_id", userIds);
  const { data, error } = await query;
  if (error) throw new Error(`load push subscriptions failed: ${error.message}`);
  return sendPush(data, payload, transport, async (ids) => {
    const { error: pruneError } = await admin.from("push_subscriptions").delete().in("id", ids);
    if (pruneError) console.error("push prune failed", pruneError.message);
  });
}

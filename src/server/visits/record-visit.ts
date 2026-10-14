import "server-only";

import { z } from "zod";
import type { TypedClient } from "@/server/db/types";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** last_seen_at is only rewritten when it is older than this. */
const LAST_SEEN_REFRESH_MS = 5 * 60 * 1000;

export const visitSchema = z.object({
  path: z.string().startsWith("/").max(300),
  referrer: z.string().max(500).optional().default(""),
  utm: z.partialRecord(z.enum(UTM_KEYS), z.string().max(200)).optional(),
});

export async function recordVisit(
  admin: TypedClient,
  v: {
    anonId: string;
    userId: string | null;
    path: string;
    referrer: string;
    utm?: Partial<Record<(typeof UTM_KEYS)[number], string>>;
    device: "mobile" | "tablet" | "desktop";
  },
): Promise<void> {
  const { error } = await admin.from("visits").insert({
    anon_id: v.anonId,
    user_id: v.userId,
    path: v.path,
    referrer: v.referrer || null,
    utm: v.utm && Object.keys(v.utm).length ? v.utm : null,
    device: v.device,
  });
  if (error) throw new Error(`record visit failed (code ${error.code || "unknown"})`);
  if (v.userId) {
    // One conditional write: skip it when last_seen_at is already fresh.
    const staleBefore = new Date(Date.now() - LAST_SEEN_REFRESH_MS).toISOString();
    await admin
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", v.userId)
      .or(`last_seen_at.is.null,last_seen_at.lt.${staleBefore}`);
  }
}

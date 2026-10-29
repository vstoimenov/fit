import "server-only";

import { z } from "zod";
import { safeNext } from "@/lib/auth-redirect";
import type { TypedClient } from "@/server/db/types";
import { studioOnlyUserIds } from "@/server/studio/members";
import { sendToUsers, type PushReport, type PushTransport } from "./send";

/** The owner's broadcast form; links stay inside the app. */
export const broadcastSchema = z.object({
  title: z.string().trim().min(1, "Напиши заглавие").max(80, "Заглавието е до 80 знака"),
  body: z.string().trim().min(1, "Напиши текст").max(200, "Текстът е до 200 знака"),
  url: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z
      .string()
      .trim()
      .max(512)
      .refine(
        (u) => safeNext(u, "\u0000") !== "\u0000",
        "Линкът трябва да започва с / (вътре в приложението)",
      )
      .nullable(),
  ),
});
export type BroadcastInput = z.infer<typeof broadcastSchema>;

/** Sends to every subscribed member and logs the send with who pressed the button. */
export async function sendBroadcast(
  admin: TypedClient,
  createdBy: string,
  input: BroadcastInput,
  transport: PushTransport,
): Promise<PushReport> {
  const report = await sendToUsers(
    admin,
    "all",
    {
      title: input.title,
      body: input.body,
      url: input.url ?? "/app",
      tag: `broadcast-${Date.now()}`,
    },
    transport,
    // Gym-only clients did not join the online club: its news is not for them.
    { exclude: await studioOnlyUserIds(admin) },
  );
  const { error } = await admin.from("push_sends").insert({
    kind: "broadcast",
    title: input.title,
    body: input.body,
    url: input.url,
    recipients: report.users,
    created_by: createdBy,
  });
  if (error) throw new Error(`log broadcast failed: ${error.message}`);
  return report;
}

export interface PushSendRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  recipients: number;
  created_at: string;
}

/** The last sends, newest first (admin RLS). */
export async function listPushSends(db: TypedClient, limit = 20): Promise<PushSendRow[]> {
  const { data, error } = await db
    .from("push_sends")
    .select("id, kind, title, body, url, recipients, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`list push sends failed: ${error.message}`);
  return data;
}

/** How many members have at least one device subscribed (admin RLS). */
export async function countSubscribedMembers(db: TypedClient): Promise<number> {
  const users = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("push_subscriptions")
      .select("user_id")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`count push subscriptions failed: ${error.message}`);
    for (const r of data) users.add(r.user_id);
    if (data.length < 1000) break;
  }
  return users.size;
}

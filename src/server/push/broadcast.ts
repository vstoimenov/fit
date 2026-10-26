import "server-only";

import { z } from "zod";
import type { TypedClient } from "@/server/db/types";
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
      .regex(/^\/(?!\/)[^\s]*$/, "Линкът трябва да започва с / (вътре в приложението)")
      .max(512)
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
    { title: input.title, body: input.body, url: input.url ?? "/app" },
    transport,
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
  const { data, error } = await db.from("push_subscriptions").select("user_id");
  if (error) throw new Error(`count push subscriptions failed: ${error.message}`);
  return new Set(data.map((r) => r.user_id)).size;
}

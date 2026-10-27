import "server-only";

import { z } from "zod";
import type { TypedClient } from "@/server/db/types";

const reportRow = z.object({
  id: z.string(),
  post_id: z.string().nullable(),
  comment_id: z.string().nullable(),
  reason: z.string(),
  created_at: z.string(),
  reporter: z.string(),
  body: z.string().nullable(),
  author: z.string().nullable(),
  hidden: z.boolean(),
  context_post_id: z.string().nullable(),
});
export type CommunityReport = z.infer<typeof reportRow>;

/** Open reports with the reported text, newest first (admin only). */
export async function listReports(db: TypedClient): Promise<CommunityReport[]> {
  const { data, error } = await db.rpc("community_reports");
  if (error) throw new Error(`load community reports failed: ${error.message}`);
  if (!Array.isArray(data)) return [];
  // One malformed row must not empty the list.
  return data.flatMap((item) => {
    const parsed = reportRow.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export async function moderatePost(db: TypedClient, id: string, hidden: boolean): Promise<void> {
  const { error } = await db.rpc("admin_moderate_post", { p_id: id, p_hidden: hidden });
  if (error) throw new Error(`moderate post failed: ${error.message}`);
}

export async function moderateComment(db: TypedClient, id: string, hidden: boolean): Promise<void> {
  const { error } = await db.rpc("admin_moderate_comment", { p_id: id, p_hidden: hidden });
  if (error) throw new Error(`moderate comment failed: ${error.message}`);
}

/** Deletes the post and, with the service role, the photo it showed. */
export async function deletePostAsAdmin(
  db: TypedClient,
  serviceRole: TypedClient,
  id: string,
): Promise<void> {
  const { data, error } = await db.rpc("admin_delete_post", { p_id: id });
  if (error) throw new Error(`delete post failed: ${error.message}`);
  if (data) {
    const { error: removeError } = await serviceRole.storage
      .from("community-photos")
      .remove([data]);
    if (removeError) console.error("community photo remove failed", data, removeError.message);
  }
}

export async function deleteCommentAsAdmin(db: TypedClient, id: string): Promise<void> {
  const { error } = await db.rpc("admin_delete_comment", { p_id: id });
  if (error) throw new Error(`delete comment failed: ${error.message}`);
}

export async function dismissReport(db: TypedClient, id: string): Promise<void> {
  const { error } = await db.rpc("admin_dismiss_report", { p_id: id });
  if (error) throw new Error(`dismiss report failed: ${error.message}`);
}

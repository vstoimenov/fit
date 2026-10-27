import "server-only";

import { z } from "zod";
import { AppError } from "@/lib/app-error";
import type { TypedClient } from "@/server/db/types";

const FORBIDDEN = "Общността е за абонатки.";

function translate(error: { code: string; message: string }, fallback: string): never {
  if (error.code === "42501") throw new AppError("FORBIDDEN", FORBIDDEN);
  if (error.code === "P0001") throw new AppError("INVALID", error.message);
  if (error.code === "P0002") {
    throw new AppError(
      "NOT_FOUND",
      error.message.includes("photo")
        ? "Снимката не се качи. Опитай пак."
        : "Публикацията вече я няма.",
    );
  }
  if (error.code === "22023") throw new AppError("INVALID", fallback);
  throw new Error(`${fallback}: ${error.message}`);
}

export async function createPost(
  db: TypedClient,
  input: { body: string; photoPath: string | null; completionId: string | null },
): Promise<string> {
  const { data, error } = await db.rpc("create_post", {
    p_body: input.body,
    p_photo_path: input.photoPath ?? "",
    p_completion_id: input.completionId ?? "",
  });
  if (error) translate(error, "Напиши нещо (до 1000 знака).");
  return data;
}

export async function createComment(
  db: TypedClient,
  postId: string,
  body: string,
): Promise<string> {
  const { data, error } = await db.rpc("create_comment", { p_post_id: postId, p_body: body });
  if (error) translate(error, "Напиши нещо (до 500 знака).");
  return data;
}

/** Returns the fresh state and count. */
export async function toggleHeart(
  db: TypedClient,
  postId: string,
): Promise<{ hearted: boolean; hearts: number }> {
  const { data, error } = await db.rpc("toggle_heart", { p_post_id: postId });
  if (error) translate(error, "Не успяхме да отбележим.");
  const parsed = z.object({ hearted: z.boolean(), hearts: z.number() }).safeParse(data);
  if (!parsed.success) throw new Error("toggle heart returned an unexpected shape");
  return parsed.data;
}

export async function reportContent(
  db: TypedClient,
  target: { postId?: string; commentId?: string },
  reason: string,
): Promise<void> {
  const { error } = await db.rpc("report_content", {
    p_post_id: target.postId ?? "",
    p_comment_id: target.commentId ?? "",
    p_reason: reason,
  });
  if (error) translate(error, "Не успяхме да изпратим сигнала.");
}

const BUCKET = "community-photos";

/** Deletes her post and, with her own client, the photo it showed. */
export async function deleteOwnPost(db: TypedClient, id: string): Promise<void> {
  const { data, error } = await db.rpc("delete_own_post", { p_id: id });
  if (error) translate(error, "Не успяхме да изтрием.");
  if (data) await removeCommunityPhoto(db, data);
}

export async function removeCommunityPhoto(db: TypedClient, path: string): Promise<void> {
  const { error } = await db.storage.from(BUCKET).remove([path]);
  if (error) console.error("community photo remove failed", path, error.message);
}

const REMOVE_PAGE = 100;

/** Every community photo of a member (account deletion), with the service role. */
export async function removeAllCommunityPhotos(admin: TypedClient, userId: string): Promise<void> {
  const bucket = admin.storage.from(BUCKET);
  for (;;) {
    const { data: page, error } = await bucket.list(userId, { limit: REMOVE_PAGE, offset: 0 });
    if (error) throw new Error(`list community photos failed: ${error.message}`);
    const paths = page.filter((o) => o.id !== null).map((o) => `${userId}/${o.name}`);
    if (paths.length === 0) return;
    const { data: removed, error: removeError } = await bucket.remove(paths);
    if (removeError) throw new Error(`remove community photos failed: ${removeError.message}`);
    if (removed.length === 0)
      throw new Error("remove community photos failed: nothing was removed");
  }
}

export async function deleteOwnComment(db: TypedClient, id: string): Promise<void> {
  const { error } = await db.rpc("delete_own_comment", { p_id: id });
  if (error) translate(error, "Не успяхме да изтрием.");
}

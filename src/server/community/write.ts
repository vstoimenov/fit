import "server-only";

import { AppError } from "@/lib/app-error";
import type { TypedClient } from "@/server/db/types";

const FORBIDDEN = "Общността е за абонатки.";

function translate(error: { code: string; message: string }, fallback: string): never {
  if (error.code === "42501") throw new AppError("FORBIDDEN", FORBIDDEN);
  if (error.code === "P0001") throw new AppError("INVALID", error.message);
  if (error.code === "P0002") throw new AppError("NOT_FOUND", "Публикацията вече я няма.");
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
  if (error) translate(error, "Напиши до 1000 знака.");
  return data;
}

export async function createComment(
  db: TypedClient,
  postId: string,
  body: string,
): Promise<string> {
  const { data, error } = await db.rpc("create_comment", { p_post_id: postId, p_body: body });
  if (error) translate(error, "Напиши до 500 знака.");
  return data;
}

/** Returns the new state (true = hearted). */
export async function toggleHeart(db: TypedClient, postId: string): Promise<boolean> {
  const { data, error } = await db.rpc("toggle_heart", { p_post_id: postId });
  if (error) translate(error, "Не успяхме да отбележим.");
  return data;
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

export async function deleteOwnPost(db: TypedClient, id: string): Promise<void> {
  const { error } = await db.rpc("delete_own_post", { p_id: id });
  if (error) translate(error, "Не успяхме да изтрием.");
}

export async function deleteOwnComment(db: TypedClient, id: string): Promise<void> {
  const { error } = await db.rpc("delete_own_comment", { p_id: id });
  if (error) translate(error, "Не успяхме да изтрием.");
}

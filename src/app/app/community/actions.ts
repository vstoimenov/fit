"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/server/auth/require-user";
import {
  createComment,
  createPost,
  deleteOwnComment,
  deleteOwnPost,
  reportContent,
  toggleHeart,
} from "@/server/community/write";

export type ComposerState = {
  status: "idle" | "ok" | "error";
  message?: string;
  body?: string;
  /** Changes on every successful post, so the composer knows to clear its photo. */
  token?: string;
};

const optionalUuid = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : v),
  z.uuid().nullable(),
);

function revalidateCommunity() {
  revalidatePath("/app/community");
  revalidatePath("/app");
}

export async function createPostAction(
  _prev: ComposerState,
  form: FormData,
): Promise<ComposerState> {
  const body = String(form.get("body") ?? "").slice(0, 1100);
  try {
    const { supabase } = await requireUser();
    const photoPath =
      z
        .string()
        .max(200)
        .parse(form.get("photoPath") ?? "") || null;
    const completionId = optionalUuid.parse(form.get("completionId") ?? "");
    await createPost(supabase, { body, photoPath, completionId });
  } catch (error) {
    return { status: "error", message: actionFail(error).message, body };
  }
  revalidateCommunity();
  return { status: "ok", token: crypto.randomUUID() };
}

export async function createCommentAction(
  postId: string,
  _prev: ComposerState,
  form: FormData,
): Promise<ComposerState> {
  const body = String(form.get("body") ?? "").slice(0, 600);
  try {
    const { supabase } = await requireUser();
    await createComment(supabase, z.uuid().parse(postId), body);
  } catch (error) {
    return { status: "error", message: actionFail(error).message, body };
  }
  revalidatePath(`/app/community/${postId}`);
  revalidateCommunity();
  return { status: "idle" };
}

/** No revalidation: the optimistic state plus the fresh count are enough, and a re-render would re-sign every photo. */
export async function toggleHeartAction(
  postId: string,
): Promise<ActionResult<{ hearted: boolean; hearts: number }>> {
  try {
    const { supabase } = await requireUser();
    return actionOk(await toggleHeart(supabase, z.uuid().parse(postId)));
  } catch (error) {
    return actionFail(error);
  }
}

export async function reportAction(
  target: { postId?: string; commentId?: string },
  reason: string,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    await reportContent(
      supabase,
      {
        postId: target.postId ? z.uuid().parse(target.postId) : undefined,
        commentId: target.commentId ? z.uuid().parse(target.commentId) : undefined,
      },
      z.string().max(300).parse(reason),
    );
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteOwnPostAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    await deleteOwnPost(supabase, z.uuid().parse(id));
  } catch (error) {
    return actionFail(error);
  }
  revalidateCommunity();
  redirect("/app/community");
}

export async function deleteOwnCommentAction(
  id: string,
  postId: string,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireUser();
    await deleteOwnComment(supabase, z.uuid().parse(id));
    revalidatePath(`/app/community/${postId}`);
    revalidateCommunity();
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

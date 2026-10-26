"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { formBool, formString } from "@/lib/form-data";
import { deleteArticle, saveArticle, setPublished } from "@/server/admin/articles";
import { requireAdmin } from "@/server/admin/require-admin";

const idSchema = z.uuid();

function validId(id: string): string {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new AppError("INVALID", "Невалидна статия.");
  return parsed.data;
}

function readArticle(form: FormData) {
  return {
    title: formString(form, "title"),
    slug: formString(form, "slug"),
    excerpt: formString(form, "excerpt"),
    // Browsers submit textarea line breaks as CRLF.
    body: formString(form, "body").replace(/\r\n/g, "\n"),
    coverUrl: formString(form, "coverUrl"),
    level: formString(form, "level"),
    membersOnly: formBool(form, "membersOnly"),
    category: formString(form, "category") || "article",
  };
}

function revalidate(id?: string) {
  revalidatePath("/admin/articles");
  if (id) revalidatePath(`/admin/articles/${id}`);
}

export async function createArticleAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  let id: string;
  try {
    const { supabase } = await requireAdmin();
    ({ id } = await saveArticle(supabase, null, readArticle(form)));
  } catch (error) {
    return actionFail(error);
  }
  revalidate();
  redirect(`/admin/articles/${id}?saved=1`);
}

export async function updateArticleAction(
  id: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const articleId = validId(id);
    await saveArticle(supabase, articleId, readArticle(form));
    revalidate(articleId);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

/** `publish` and `unpublish` are two bound variants of the same action. */
export async function setPublishedAction(
  id: string,
  published: boolean,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const articleId = validId(id);
    await setPublished(supabase, articleId, published);
    revalidate(articleId);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteArticleAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await deleteArticle(supabase, validId(id));
  } catch (error) {
    return actionFail(error);
  }
  revalidate();
  redirect("/admin/articles");
}

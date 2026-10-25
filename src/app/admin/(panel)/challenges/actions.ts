"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { formBool, formInt, formString } from "@/lib/form-data";
import { deleteChallenge, saveChallenge } from "@/server/admin/challenges";
import { requireAdmin } from "@/server/admin/require-admin";

const idSchema = z.uuid();

function validId(id: string): string {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new AppError("INVALID", "Невалидно предизвикателство.");
  return parsed.data;
}

/** One task text and one workout choice per day, in day order; an empty choice means no workout. */
function readChallenge(form: FormData) {
  const texts = form.getAll("task").map((v) => (typeof v === "string" ? v.trim() : ""));
  const workouts = form.getAll("workoutId").map((v) => (typeof v === "string" ? v.trim() : ""));
  return {
    title: formString(form, "title"),
    // Browsers submit textarea line breaks as CRLF.
    description: formString(form, "description").replace(/\r\n/g, "\n"),
    startDate: formString(form, "startDate"),
    days: formInt(form, "days"),
    published: formBool(form, "published"),
    tasks: texts.map((task, i) => ({ task, workoutId: workouts[i] || null })),
  };
}

function revalidate(id?: string) {
  revalidatePath("/admin/challenges");
  if (id) revalidatePath(`/admin/challenges/${id}`);
}

export async function createChallengeAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  let id: string;
  try {
    const { supabase } = await requireAdmin();
    id = await saveChallenge(supabase, readChallenge(form));
  } catch (error) {
    return actionFail(error);
  }
  revalidate();
  redirect(`/admin/challenges/${id}?saved=1`);
}

export async function updateChallengeAction(
  id: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const challengeId = validId(id);
    await saveChallenge(supabase, { ...readChallenge(form), id: challengeId });
    revalidate(challengeId);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteChallengeAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await deleteChallenge(supabase, validId(id));
  } catch (error) {
    return actionFail(error);
  }
  revalidate();
  redirect("/admin/challenges");
}

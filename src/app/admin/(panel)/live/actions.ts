"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { formBool, formString } from "@/lib/form-data";
import { requireAdmin } from "@/server/admin/require-admin";
import { deleteLiveSession, liveInputSchema, saveLiveSession } from "@/server/live/admin";

function read(form: FormData) {
  return liveInputSchema.parse({
    title: formString(form, "title"),
    description: formString(form, "description"),
    date: formString(form, "date"),
    time: formString(form, "time"),
    durationMin: formString(form, "durationMin"),
    joinUrl: formString(form, "joinUrl"),
    recordingUrl: formString(form, "recordingUrl"),
    published: formBool(form, "published"),
  });
}

export async function saveLiveAction(
  id: string | null,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase } = await requireAdmin();
    const result = await saveLiveSession(
      supabase,
      id === null ? null : z.uuid().parse(id),
      read(form),
    );
    revalidatePath("/admin/live");
    revalidatePath("/app");
    return actionOk(result);
  } catch (error) {
    return actionFail(error);
  }
}

export async function deleteLiveAction(id: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    await deleteLiveSession(supabase, z.uuid().parse(id));
    revalidatePath("/admin/live");
    revalidatePath("/app");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

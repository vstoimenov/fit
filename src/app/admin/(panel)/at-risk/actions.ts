"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { formString } from "@/lib/form-data";
import { createMailer } from "@/server/admin/mailer";
import { addNote } from "@/server/admin/notes";
import { requireAdmin } from "@/server/admin/require-admin";
import { sendNudge } from "@/server/admin/risk";
import { getSettings } from "@/server/admin/settings";

export async function nudgeAction(
  userId: string,
): Promise<ActionResult<{ delivered: boolean; recorded: boolean }>> {
  try {
    const id = z.uuid().parse(userId);
    const { supabase } = await requireAdmin();
    const settings = await getSettings(supabase);
    const result = await sendNudge(supabase, createMailer(serverEnv), id, settings.email_templates);
    revalidatePath("/admin/at-risk");
    revalidatePath(`/admin/clients/${id}`);
    return actionOk(result);
  } catch (error) {
    return actionFail(error);
  }
}

export async function snoozeAction(userId: string): Promise<ActionResult<null>> {
  try {
    const id = z.uuid().parse(userId);
    const { supabase } = await requireAdmin();
    await addNote(supabase, id, { kind: "snooze", days: 7 });
    revalidatePath("/admin/at-risk");
    revalidatePath(`/admin/clients/${id}`);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

const quickKindSchema = z.enum(["call", "note"]);

/** A short note after a phone call (or a plain note) straight from the list. */
export async function quickNoteAction(
  userId: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const id = z.uuid().parse(userId);
    const kind = quickKindSchema.parse(formString(form, "kind"));
    const { supabase } = await requireAdmin();
    await addNote(supabase, id, { kind, body: formString(form, "body") });
    revalidatePath("/admin/at-risk");
    revalidatePath(`/admin/clients/${id}`);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

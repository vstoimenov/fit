"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@/lib/app-error";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { formInt, formString } from "@/lib/form-data";
import { grantManualAccess, revokeManualAccess } from "@/server/admin/clients";
import { addNote } from "@/server/admin/notes";
import { requireAdmin } from "@/server/admin/require-admin";

const idSchema = z.uuid();

function validId(id: string): string {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) throw new AppError("INVALID", "Невалидна клиентка.");
  return parsed.data;
}

export async function addNoteAction(
  userId: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const id = validId(userId);
    const { supabase } = await requireAdmin();
    const kind = formString(form, "kind");
    await addNote(
      supabase,
      id,
      kind === "snooze"
        ? { kind, days: formInt(form, "days") }
        : { kind, body: formString(form, "body") },
    );
    revalidatePath(`/admin/clients/${id}`);
    revalidatePath("/admin/at-risk");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function grantAccessAction(
  userId: string,
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<null>> {
  try {
    const id = validId(userId);
    const { supabase } = await requireAdmin();
    await grantManualAccess(supabase, id, formInt(form, "days"));
    revalidatePath(`/admin/clients/${id}`);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

export async function revokeAccessAction(userId: string): Promise<ActionResult<null>> {
  try {
    const id = validId(userId);
    const { supabase } = await requireAdmin();
    await revokeManualAccess(supabase, id);
    revalidatePath(`/admin/clients/${id}`);
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@/lib/app-error";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { previewLinks, saveBulk, type LinkPreview } from "@/server/admin/bulk";
import { requireAdmin } from "@/server/admin/require-admin";
import { moveWorkoutToDate } from "@/server/admin/workouts";

export async function previewLinksAction(text: string): Promise<ActionResult<LinkPreview[]>> {
  try {
    await requireAdmin();
    return actionOk(await previewLinks(z.string().max(20_000).parse(text)));
  } catch (error) {
    return actionFail(error);
  }
}

export async function saveBulkAction(
  rows: unknown,
): Promise<ActionResult<{ created: number; errors: { index: number; message: string }[] }>> {
  try {
    const { user, supabase } = await requireAdmin();
    const result = await saveBulk(supabase, user.id, rows);
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/workouts");
    return actionOk(result);
  } catch (error) {
    return actionFail(error);
  }
}

export async function moveWorkoutAction(id: string, date: string): Promise<ActionResult<null>> {
  try {
    const { supabase } = await requireAdmin();
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) throw new AppError("INVALID", "Невалидна тренировка.");
    await moveWorkoutToDate(supabase, parsed.data, date);
    revalidatePath("/admin/calendar");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

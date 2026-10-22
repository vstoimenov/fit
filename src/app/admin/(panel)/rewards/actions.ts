"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { requireAdmin } from "@/server/admin/require-admin";
import { setRewardGiven } from "@/server/admin/rewards";

const idSchema = z.uuid();
const levelSchema = z.union([z.literal(4), z.literal(8), z.literal(10)]);

/** Bound to (userId, level, given) by the page; the form itself carries no fields. */
export async function setRewardGivenAction(
  userId: string,
  level: number,
  given: boolean,
): Promise<ActionResult<null>> {
  try {
    const id = idSchema.safeParse(userId);
    if (!id.success) throw new AppError("INVALID", "Невалидна клиентка.");
    const lvl = levelSchema.safeParse(level);
    if (!lvl.success) throw new AppError("INVALID", "Тази награда не се дава ръчно.");
    const { supabase } = await requireAdmin();
    await setRewardGiven(supabase, id.data, lvl.data, given);
    revalidatePath("/admin/rewards");
    return actionOk(null);
  } catch (error) {
    return actionFail(error);
  }
}

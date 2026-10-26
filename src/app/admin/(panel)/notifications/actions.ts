"use server";

import { revalidatePath } from "next/cache";
import { serverEnv } from "@/env";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/app-error";
import { formString } from "@/lib/form-data";
import { requireAdmin } from "@/server/admin/require-admin";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { broadcastSchema, sendBroadcast } from "@/server/push/broadcast";
import { webPushTransport } from "@/server/push/send";

export async function sendBroadcastAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ users: number }>> {
  try {
    const { user } = await requireAdmin();
    const transport = webPushTransport(serverEnv);
    if (!transport)
      throw new AppError("INVALID", "Известията още не са настроени (VAPID ключове).");
    const input = broadcastSchema.parse({
      title: formString(form, "title"),
      body: formString(form, "body"),
      url: formString(form, "url"),
    });
    const report = await sendBroadcast(createAdminSupabaseClient(), user.id, input, transport);
    revalidatePath("/admin/notifications");
    return actionOk({ users: report.users });
  } catch (error) {
    return actionFail(error);
  }
}

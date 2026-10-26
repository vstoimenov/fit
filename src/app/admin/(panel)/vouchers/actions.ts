"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { formString } from "@/lib/form-data";
import { formatCode } from "@/lib/gift/code";
import { requireAdmin } from "@/server/admin/require-admin";
import { issueVoucher } from "@/server/gift/admin";

const schema = z.object({
  months: z.coerce.number().refine((m) => [1, 3, 12].includes(m), "1, 3 или 12 месеца"),
  recipientName: z.string().trim().max(60).nullable(),
  note: z.string().trim().max(200).nullable(),
});

export async function issueVoucherAction(
  _prev: unknown,
  form: FormData,
): Promise<ActionResult<{ code: string }>> {
  try {
    const { supabase } = await requireAdmin();
    const input = schema.parse({
      months: formString(form, "months"),
      recipientName: formString(form, "recipientName") || null,
      note: formString(form, "note") || null,
    });
    const code = await issueVoucher(supabase, input);
    revalidatePath("/admin/vouchers");
    return actionOk({ code: formatCode(code) });
  } catch (error) {
    return actionFail(error);
  }
}

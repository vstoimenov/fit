"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAppError } from "@/lib/app-error";
import { normalizeCode } from "@/lib/gift/code";
import { requireUser } from "@/server/auth/require-user";
import { redeemGift } from "@/server/gift/redeem";

export type RedeemState =
  | { status: "idle" }
  | { status: "error"; message: string; code: string }
  | { status: "ok"; periodEnd: string };

export async function redeemGiftAction(_prev: RedeemState, form: FormData): Promise<RedeemState> {
  // Echoed back so a typo does not wipe the field (React resets the form after an action).
  const typed = String(form.get("code") ?? "").slice(0, 40);
  try {
    const { supabase } = await requireUser();
    const code = normalizeCode(z.string().max(40).parse(typed));
    if (code.length !== 10) {
      return { status: "error", message: "Кодът има 10 букви и цифри.", code: typed };
    }
    const result = await redeemGift(supabase, code);
    if (!result.ok) return { status: "error", message: result.message, code: typed };
    revalidatePath("/app", "layout");
    return { status: "ok", periodEnd: result.periodEnd };
  } catch (error) {
    const message =
      isAppError(error) && error.code === "UNAUTHORIZED"
        ? "Влез в профила си и опитай пак."
        : "Нещо се обърка. Опитай отново.";
    return { status: "error", message, code: typed };
  }
}

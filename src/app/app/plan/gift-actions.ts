"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeCode } from "@/lib/gift/code";
import { requireUser } from "@/server/auth/require-user";
import { redeemGift } from "@/server/gift/redeem";

export type RedeemState =
  { status: "idle" } | { status: "error"; message: string } | { status: "ok"; periodEnd: string };

export async function redeemGiftAction(_prev: RedeemState, form: FormData): Promise<RedeemState> {
  try {
    const { supabase } = await requireUser();
    const code = normalizeCode(
      z
        .string()
        .max(40)
        .parse(form.get("code") ?? ""),
    );
    if (code.length !== 10) return { status: "error", message: "Кодът има 10 букви и цифри." };
    const result = await redeemGift(supabase, code);
    if (!result.ok) return { status: "error", message: result.message };
    revalidatePath("/app", "layout");
    return { status: "ok", periodEnd: result.periodEnd };
  } catch {
    return { status: "error", message: "Нещо се обърка. Опитай отново." };
  }
}

import "server-only";

import type { TypedClient } from "@/server/db/types";

/** The RPC raises short English reasons; she reads Bulgarian. */
export function redeemErrorMessage(dbMessage: string): string {
  if (dbMessage.includes("not found")) return "Няма такъв код. Провери буквите и цифрите.";
  if (dbMessage.includes("already used")) return "Този код вече е използван.";
  if (dbMessage.includes("expired")) return "Кодът е изтекъл (важи 12 месеца от покупката).";
  if (dbMessage.includes("paid subscription"))
    return "Имаш активен платен абонамент. Активирай ваучера, когато той приключи — кодът остава валиден.";
  return "Нещо се обърка. Опитай отново.";
}

/** Redeems with her own session (the RPC checks auth.uid()); returns the new period end. */
export async function redeemGift(
  db: TypedClient,
  code: string,
): Promise<{ ok: true; periodEnd: string } | { ok: false; message: string }> {
  const { data, error } = await db.rpc("redeem_gift_voucher", { p_code: code });
  if (error) return { ok: false, message: redeemErrorMessage(error.message) };
  return { ok: true, periodEnd: data };
}

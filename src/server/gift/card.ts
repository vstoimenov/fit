import "server-only";

import { normalizeCode } from "@/lib/gift/code";
import type { TypedClient } from "@/server/db/types";

export interface VoucherCard {
  code: string;
  months: number;
  recipientName: string | null;
  message: string | null;
  expiresAt: string;
  redeemed: boolean;
}

/** The printable card for a code (public page: the code itself is the secret). */
export async function getVoucherCard(admin: TypedClient, raw: string): Promise<VoucherCard | null> {
  const code = normalizeCode(raw);
  if (!/^[A-Z2-9]{10}$/.test(code)) return null;
  const { data, error } = await admin
    .from("gift_vouchers")
    .select("code, months, recipient_name, message, expires_at, redeemed_at")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(`load voucher card failed: ${error.message}`);
  if (!data) return null;
  return {
    code: data.code,
    months: data.months,
    recipientName: data.recipient_name,
    message: data.message,
    expiresAt: data.expires_at,
    redeemed: data.redeemed_at !== null,
  };
}

/** For the thank-you page: the code for a paid session, once the webhook has created it. */
export async function getVoucherBySession(
  admin: TypedClient,
  sessionId: string,
): Promise<{ code: string; months: number } | null> {
  const { data, error } = await admin
    .from("gift_vouchers")
    .select("code, months")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`load voucher by session failed: ${error.message}`);
  return data;
}

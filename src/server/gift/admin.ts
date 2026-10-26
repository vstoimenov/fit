import "server-only";

import type { TypedClient } from "@/server/db/types";

export interface VoucherRow {
  id: string;
  code: string;
  months: number;
  amount_cents: number;
  kind: string;
  buyer_email: string | null;
  recipient_name: string | null;
  note: string | null;
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
}

/** Newest vouchers first (admin RLS). */
export async function listVouchers(db: TypedClient, limit = 200): Promise<VoucherRow[]> {
  const { data, error } = await db
    .from("gift_vouchers")
    .select(
      "id, code, months, amount_cents, kind, buyer_email, recipient_name, note, created_at, expires_at, redeemed_at, redeemed_by",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`list vouchers failed: ${error.message}`);
  return data;
}

/** The owner issues a free voucher; returns its code. */
export async function issueVoucher(
  db: TypedClient,
  input: { months: number; recipientName: string | null; note: string | null },
): Promise<string> {
  const { data, error } = await db.rpc("issue_gift_voucher", {
    p_months: input.months,
    // The RPC turns blanks into null; the generated types want strings.
    p_recipient_name: input.recipientName ?? "",
    p_note: input.note ?? "",
  });
  if (error) throw new Error(`issue voucher failed: ${error.message}`);
  return data;
}

import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { getVoucherBySession } from "@/server/gift/card";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/** The thank-you page asks whether the webhook has created the voucher for this session yet. */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id") ?? "";
  if (!/^cs_[A-Za-z0-9_]{8,120}$/.test(sessionId)) {
    return NextResponse.json({ error: "bad session" }, { status: 400, headers: NO_STORE });
  }
  const found = await getVoucherBySession(createAdminSupabaseClient(), sessionId);
  if (!found) return NextResponse.json({ error: "pending" }, { status: 404, headers: NO_STORE });
  return NextResponse.json(found, { headers: NO_STORE });
}

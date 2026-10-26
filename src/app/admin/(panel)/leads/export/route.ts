import { NextResponse } from "next/server";
import { AppError } from "@/lib/app-error";
import { leadsCsv, listAllLeads } from "@/server/admin/leads";
import { requireAdmin } from "@/server/admin/require-admin";

/** CSV of every lead, for the owner's spreadsheet. Admin only. */
export async function GET() {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    const status = error instanceof AppError && error.code === "MFA_REQUIRED" ? 403 : 401;
    return new NextResponse("Нямаш достъп.", { status });
  }
  const rows = await listAllLeads(supabase);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(leadsCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}

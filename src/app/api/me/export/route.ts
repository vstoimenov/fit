import { NextResponse } from "next/server";
import { isAppError } from "@/lib/app-error";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { requireUser } from "@/server/auth/require-user";
import { exportMyData } from "@/server/profile/profile";

export async function GET() {
  try {
    const { user, supabase } = await requireUser();
    const data = await exportMyData(supabase, user.id, createAdminSupabaseClient());
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="moite-danni-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = isAppError(error) && error.code === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: "export failed" }, { status });
  }
}

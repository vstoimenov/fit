import { NextResponse } from "next/server";
import { isAppError } from "@/lib/app-error";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { requireUser } from "@/server/auth/require-user";
import { exportMyData } from "@/server/profile/profile";

export async function GET(request: Request) {
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
    // She tapped a link, so she would land on raw JSON: send her back with a message instead.
    if (isAppError(error) && error.code === "UNAUTHORIZED") {
      return NextResponse.redirect(new URL("/login?next=/app/profile", request.url), 303);
    }
    console.error("data export failed", error instanceof Error ? error.message : String(error));
    return NextResponse.redirect(new URL("/app/profile?export=failed", request.url), 303);
  }
}

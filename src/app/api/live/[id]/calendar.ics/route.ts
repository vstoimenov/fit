import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/env";
import { isAppError } from "@/lib/app-error";
import { buildIcs } from "@/lib/live/ics";
import { requireUser } from "@/server/auth/require-user";
import { getLiveSession } from "@/server/live/sessions";

/** „Добави в календара": one .ics for the session, members only (RLS decides). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const { supabase } = await requireUser();
    const parsed = z.uuid().safeParse(id);
    const session = parsed.success ? await getLiveSession(supabase, parsed.data) : null;
    if (!session) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(buildIcs(session, serverEnv.APP_URL), {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="iamstrong-live.ics"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (isAppError(error) && error.code === "UNAUTHORIZED") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    console.error("[api/live/ics]", error instanceof Error ? error.message : "unknown error");
    return new NextResponse("Calendar failed", { status: 500 });
  }
}

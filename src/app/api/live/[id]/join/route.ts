import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/env";
import { isAppError } from "@/lib/app-error";
import { requireUser } from "@/server/auth/require-user";
import { attendLive, getLiveSession } from "@/server/live/sessions";

/**
 * „Влизам": records attendance (5 points once, inside the window) in the same navigation that
 * opens the room, so a backgrounded app, a middle-click or a long-press cannot lose it.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const { supabase } = await requireUser();
    const parsed = z.uuid().safeParse(id);
    const session = parsed.success ? await getLiveSession(supabase, parsed.data) : null;
    if (!session) return NextResponse.redirect(new URL("/app", serverEnv.APP_URL), 302);
    // Outside the window the room still opens; only the points are not awarded.
    await attendLive(supabase, session.id).catch((error: unknown) =>
      console.error("attend live failed", error instanceof Error ? error.message : error),
    );
    return NextResponse.redirect(session.joinUrl, 302);
  } catch (error) {
    if (isAppError(error) && error.code === "UNAUTHORIZED") {
      return NextResponse.redirect(new URL("/login", serverEnv.APP_URL), 302);
    }
    console.error("[api/live/join]", error instanceof Error ? error.message : "unknown error");
    return new NextResponse("Join failed", { status: 500 });
  }
}

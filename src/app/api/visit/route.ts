import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { deviceFromUserAgent } from "@/lib/device";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { createServerSupabaseClient } from "@/server/db/server";
import { recordVisit, visitSchema } from "@/server/visits/record-visit";

const COOKIE = "fp_aid";
const UUID = /^[0-9a-f-]{36}$/i;

/** First-party page view. No ad cookies, so it runs regardless of the consent banner. */
export async function POST(request: NextRequest) {
  const parsed = visitSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const existing = request.cookies.get(COOKIE)?.value;
  const anonId = existing && UUID.test(existing) ? existing : randomUUID();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    await recordVisit(createAdminSupabaseClient(), {
      anonId,
      userId: user?.id ?? null,
      path: parsed.data.path,
      referrer: parsed.data.referrer,
      utm: parsed.data.utm,
      device: deviceFromUserAgent(request.headers.get("user-agent")),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  }

  const response = new NextResponse(null, { status: 204 });
  if (anonId !== existing) {
    response.cookies.set(COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return response;
}

import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deviceFromUserAgent } from "@/lib/device";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { createServerSupabaseClient } from "@/server/db/server";
import { declaredTooLarge, isCrossSite, readCappedText } from "@/server/visits/guards";
import { recordVisit, visitSchema } from "@/server/visits/record-visit";

const COOKIE = "fp_aid";

/** First-party page view. No ad cookies, so it runs regardless of the consent banner. */
export async function POST(request: NextRequest) {
  const headers = request.headers;
  if (
    isCrossSite({
      secFetchSite: headers.get("sec-fetch-site"),
      origin: headers.get("origin"),
      host: headers.get("host") ?? request.nextUrl.host,
    })
  ) {
    return new NextResponse(null, { status: 403 });
  }
  if (declaredTooLarge(headers.get("content-length")))
    return new NextResponse(null, { status: 413 });
  const text = await readCappedText(request);
  if (text === null) return new NextResponse(null, { status: 413 });

  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // falls through to the 400 below
  }
  const parsed = visitSchema.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const existing = request.cookies.get(COOKIE)?.value;
  const anonId = existing && z.uuid().safeParse(existing).success ? existing : randomUUID();
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
    // recordVisit's message is fixed text plus the DB error code, never the raw (attacker-influenced) message.
    console.error("[api/visit]", error instanceof Error ? error.message : "unknown error");
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

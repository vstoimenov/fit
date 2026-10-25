import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/env";
import { isAppError } from "@/lib/app-error";
import { brand } from "@/lib/brand";
import { sofiaToday } from "@/lib/progress-photos/today";
import { requireUser } from "@/server/auth/require-user";
import { getChallengeView } from "@/server/challenges/challenges";

// The image is hers alone: never stored by a shared cache or the browser.
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

const SIZES = { story: { width: 1080, height: 1920 }, square: { width: 1080, height: 1080 } };

const fontDir = join(process.cwd(), "public", "fonts");
const fonts = Promise.all([
  readFile(join(fontDir, "manrope-400.ttf")),
  readFile(join(fontDir, "manrope-800.ttf")),
]);
// A missing file surfaces as a 500 on request, not as an unhandled rejection at startup.
fonts.catch(() => undefined);

const C = {
  ink: "#111111",
  inkSoft: "#5C5A55",
  white: "#FFFFFF",
  sand: "#F4F3F0",
  powder: "#E5A9AE",
  roseDeep: "#7A3B45",
} as const;

function landingHost(appUrl: string): string {
  try {
    return new URL(appUrl).host;
  } catch {
    return "";
  }
}

/**
 * The share picture of a finished challenge. It takes the title and the day count only, plus the brand
 * footer, so nothing else about her (name, points, board place) can end up on it. Powder is used for the
 * big numeral only (graphic), never for running text.
 */
function ShareImage({
  title,
  days,
  square,
  landing,
}: {
  title: string;
  days: number;
  square: boolean;
  landing: string;
}) {
  const pad = square ? 88 : 104;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: C.white,
        color: C.ink,
        fontFamily: "Manrope",
        padding: pad,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: square ? 30 : 34, fontWeight: 400, color: C.inkSoft }}>
          Завърших предизвикателството
        </div>
        <div
          style={{
            fontSize: square ? 68 : 88,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: square ? 260 : 400,
            fontWeight: 800,
            lineHeight: 0.9,
            letterSpacing: "-0.04em",
            color: C.powder,
          }}
        >
          {String(days)}
        </div>
        <div style={{ fontSize: square ? 52 : 64, fontWeight: 800, color: C.roseDeep }}>
          {days === 1 ? "ден" : "дни"}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div
          style={{
            display: "flex",
            background: C.ink,
            color: C.white,
            borderRadius: 999,
            padding: square ? "14px 36px" : "18px 44px",
            fontSize: square ? 36 : 44,
            fontWeight: 800,
          }}
        >
          {brand.name}
        </div>
        <div style={{ fontSize: square ? 28 : 32, fontWeight: 400, color: C.inkSoft }}>
          {landing}
        </div>
      </div>
    </div>
  );
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const { user, supabase } = await requireUser();
    if (!z.uuid().safeParse(id).success) {
      return new Response("Not found", { status: 404, headers: NO_STORE });
    }
    const view = await getChallengeView(supabase, user.id, id, sofiaToday());
    // Only a participant who ticked every day she was counted for has a picture to share.
    if (!view || !view.progress?.finished) {
      return new Response("Not found", { status: 404, headers: NO_STORE });
    }

    const square = request.nextUrl.searchParams.get("format") === "square";
    const [regular, extraBold] = await fonts;
    return new ImageResponse(
      <ShareImage
        title={view.challenge.title}
        days={view.progress.total}
        square={square}
        landing={landingHost(serverEnv.APP_URL)}
      />,
      {
        ...(square ? SIZES.square : SIZES.story),
        fonts: [
          { name: "Manrope", data: regular, weight: 400, style: "normal" },
          { name: "Manrope", data: extraBold, weight: 800, style: "normal" },
        ],
        headers: NO_STORE,
      },
    );
  } catch (error) {
    if (isAppError(error) && error.code === "UNAUTHORIZED") {
      return new Response("Unauthorized", { status: 401, headers: NO_STORE });
    }
    console.error(
      "[api/share/challenge]",
      error instanceof Error ? error.message : "unknown error",
    );
    return new Response("Share image failed", { status: 500, headers: NO_STORE });
  }
}

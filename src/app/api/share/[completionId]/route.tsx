import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { serverEnv } from "@/env";
import { isAppError } from "@/lib/app-error";
import { brand } from "@/lib/brand";
import { streakCaption, type ShareCard } from "@/lib/share/share-card";
import { requireUser } from "@/server/auth/require-user";
import { getShareCard } from "@/server/content/share";

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
 * The share picture. Takes only the ShareCard (title, streak, week) plus the brand footer, so
 * nothing else about her can end up on it. Powder is used for the big numeral and the week
 * dots only (graphic), never for running text.
 */
function ShareImage({
  card,
  square,
  landing,
}: {
  card: ShareCard;
  square: boolean;
  landing: string;
}) {
  const pad = square ? 88 : 104;
  const showStreak = card.streakDays > 0;
  const dot = square ? 40 : 48;
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
          Завършена тренировка
        </div>
        <div
          style={{
            fontSize: square ? 76 : 96,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          {card.workoutTitle}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: square ? 40 : 64 }}>
        {showStreak && (
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
              {String(card.streakDays)}
            </div>
            <div style={{ fontSize: square ? 52 : 64, fontWeight: 800, color: C.roseDeep }}>
              {streakCaption(card.streakDays)}
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            background: C.sand,
            borderRadius: 40,
            padding: square ? "40px 48px" : "52px 56px",
          }}
        >
          <div style={{ fontSize: square ? 52 : 64, fontWeight: 800 }}>
            {`${card.weekDone}/${card.weekTarget} тази седмица`}
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {Array.from({ length: card.weekTarget }, (_, i) => (
              <div
                key={i}
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: dot,
                  background: i < card.weekDone ? C.powder : C.white,
                  border: i < card.weekDone ? "none" : `3px solid ${C.ink}`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: square ? 40 : 48, fontWeight: 800 }}>{brand.name}</div>
        <div style={{ fontSize: square ? 28 : 32, fontWeight: 400, color: C.inkSoft }}>
          {landing}
        </div>
      </div>
    </div>
  );
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ completionId: string }> },
) {
  const { completionId } = await ctx.params;
  try {
    const { user, supabase } = await requireUser();
    const card = await getShareCard(supabase, user.id, completionId);
    if (!card) return new Response("Not found", { status: 404, headers: NO_STORE });

    const square = request.nextUrl.searchParams.get("format") === "square";
    const [regular, extraBold] = await fonts;
    return new ImageResponse(
      <ShareImage card={card} square={square} landing={landingHost(serverEnv.APP_URL)} />,
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
    console.error("[api/share]", error instanceof Error ? error.message : "unknown error");
    return new Response("Share image failed", { status: 500, headers: NO_STORE });
  }
}

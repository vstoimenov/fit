import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { formatCode } from "@/lib/gift/code";
import { giftMonthsLabel } from "@/lib/site/gift";
import { createAdminSupabaseClient } from "@/server/db/admin";
import { getVoucherCard, type VoucherCard } from "@/server/gift/card";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const SIZE = { width: 1200, height: 1600 };

const fontDir = join(process.cwd(), "public", "fonts");
const fonts = Promise.all([
  readFile(join(fontDir, "manrope-400.ttf")),
  readFile(join(fontDir, "manrope-800.ttf")),
]);
fonts.catch(() => undefined);

const C = {
  ink: "#111111",
  white: "#FFFFFF",
  powder: "#E5A9AE",
  light: "#FBEFEF",
  rose: "#7A3B45",
};

function CardImage({ card }: { card: VoucherCard }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.white,
        fontFamily: "Manrope",
        color: C.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: C.ink,
          color: C.white,
          padding: "80px 90px",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 800 }}
        >
          I AM
          <span
            style={{ background: C.powder, color: C.ink, padding: "4px 18px", borderRadius: 10 }}
          >
            STRONG
          </span>
        </div>
        <div style={{ marginTop: 70, fontSize: 24, letterSpacing: 4, opacity: 0.7 }}>
          ПОДАРЪЧЕН ВАУЧЕР
        </div>
        <div style={{ marginTop: 12, fontSize: 96, fontWeight: 800, letterSpacing: -3 }}>
          Подари сила.
        </div>
        <div style={{ marginTop: 16, fontSize: 36 }}>
          {`${giftMonthsLabel(card.months)} членство в клуба`}
        </div>
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", padding: "70px 90px", gap: 40, flex: 1 }}
      >
        {card.recipientName && (
          <div style={{ fontSize: 48, fontWeight: 800 }}>{`За ${card.recipientName}`}</div>
        )}
        {card.message && (
          <div
            style={{ fontSize: 32, lineHeight: 1.4, color: "#5C5A55" }}
          >{`„${card.message}“`}</div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: C.light,
            borderRadius: 28,
            padding: "40px 30px",
          }}
        >
          <div style={{ fontSize: 24, letterSpacing: 4, color: C.rose }}>ТВОЯТ КОД</div>
          <div style={{ marginTop: 14, fontSize: 72, fontWeight: 800, letterSpacing: 6 }}>
            {formatCode(card.code)}
          </div>
        </div>
        <div style={{ fontSize: 28, lineHeight: 1.5, color: "#5C5A55" }}>
          Влез в iamstrong.bg (или си направи профил на iamstrong.bg/start), отвори „Моят план“ и
          въведи кода. Важи 12 месеца.
        </div>
      </div>
    </div>
  );
}

export async function GET(_request: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  try {
    const card = await getVoucherCard(createAdminSupabaseClient(), code);
    if (!card) return new Response("Not found", { status: 404, headers: NO_STORE });
    const [regular, extraBold] = await fonts;
    return new ImageResponse(<CardImage card={card} />, {
      ...SIZE,
      fonts: [
        { name: "Manrope", data: regular, weight: 400, style: "normal" },
        { name: "Manrope", data: extraBold, weight: 800, style: "normal" },
      ],
      headers: NO_STORE,
    });
  } catch (error) {
    console.error("[api/gift/card]", error instanceof Error ? error.message : "unknown error");
    return new Response("Card image failed", { status: 500, headers: NO_STORE });
  }
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

const SIZES = new Set(["180", "192", "512"]);
const font = readFile(join(process.cwd(), "public", "fonts", "manrope-800.ttf"));
font.catch(() => undefined);

/**
 * Home-screen icon: the brand book's „S" mark — ink on powder, full bleed (iOS rounds the corners,
 * Android masks it). The favicon version with rounded corners lives in src/app/icon.tsx.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const raw = (await params).size;
  if (!SIZES.has(raw)) return new Response("not found", { status: 404 });
  const size = Number(raw);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brand.accentColor,
        color: brand.themeColor,
        fontFamily: "Manrope",
        fontWeight: 800,
        fontSize: size * 0.62,
        lineHeight: 1,
        // Optical centring: the S sits a touch high in its box.
        paddingTop: size * 0.03,
      }}
    >
      S
    </div>,
    {
      width: size,
      height: size,
      fonts: [{ name: "Manrope", data: await font, weight: 800, style: "normal" }],
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser-tab icon: the „S" mark on a rounded powder square. */
export default async function Icon() {
  const font = await readFile(join(process.cwd(), "public", "fonts", "manrope-800.ttf"));
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
        borderRadius: 14,
        fontFamily: "Manrope",
        fontWeight: 800,
        fontSize: 42,
        lineHeight: 1,
        paddingTop: 2,
      }}
    >
      S
    </div>,
    { ...size, fonts: [{ name: "Manrope", data: font, weight: 800, style: "normal" }] },
  );
}

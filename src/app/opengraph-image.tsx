import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "I AM STRONG — Силно тяло. 20 минути на ден. Без зала.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The OG renderer cannot use next/font, so both „I AM" and „Strong" are set in Manrope here
// (the handwritten Bad Script of the on-page logo is not available to it).
const fontDir = join(process.cwd(), "public", "fonts");

/** Share image for the public site: the logo and the three-line promise on white. */
export default async function OpenGraphImage() {
  const [regular, extraBold] = await Promise.all([
    readFile(join(fontDir, "manrope-400.ttf")),
    readFile(join(fontDir, "manrope-800.ttf")),
  ]);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#FFFFFF",
        color: "#111111",
        fontFamily: "Manrope",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 36, fontWeight: 800 }}
      >
        <span>I AM</span>
        <span
          style={{
            display: "flex",
            background: "#E5A9AE",
            borderRadius: 14,
            padding: "2px 16px 6px",
            fontWeight: 800,
          }}
        >
          Strong
        </span>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 92,
          fontWeight: 800,
          letterSpacing: -4,
          lineHeight: 1.02,
        }}
      >
        <span>Силно тяло.</span>
        <span>20 минути на ден.</span>
        <span
          style={{
            display: "flex",
            alignSelf: "flex-start",
            background: "#E5A9AE",
            borderRadius: 20,
            padding: "0 22px 8px",
            marginTop: 6,
          }}
        >
          Без зала.
        </span>
      </div>
      <div style={{ display: "flex", fontSize: 28, fontWeight: 400, color: "#5C5A55" }}>
        Онлайн клуб за тренировки у дома · с Аксения Михайлова
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Manrope", data: regular, weight: 400, style: "normal" },
        { name: "Manrope", data: extraBold, weight: 800, style: "normal" },
      ],
    },
  );
}

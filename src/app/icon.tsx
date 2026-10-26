import { ImageResponse } from "next/og";
import { FaviconMark, loadIconFonts } from "@/server/site/brand-icon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Browser-tab icon (see src/server/site/brand-icon.tsx). */
export default async function Icon() {
  const { fonts, hasScript } = await loadIconFonts();
  return new ImageResponse(<FaviconMark size={size.width} hasScript={hasScript} />, {
    ...size,
    fonts,
  });
}

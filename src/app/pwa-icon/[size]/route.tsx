import { ImageResponse } from "next/og";
import { HomeScreenIcon, loadIconFonts } from "@/server/site/brand-icon";

const SIZES = new Set(["180", "192", "512"]);

/** Home-screen icon for the manifest and apple-touch-icon (see src/server/site/brand-icon.tsx). */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const raw = (await params).size;
  if (!SIZES.has(raw)) return new Response("not found", { status: 404 });
  const size = Number(raw);
  const { fonts, hasScript } = await loadIconFonts();
  return new ImageResponse(<HomeScreenIcon size={size} hasScript={hasScript} />, {
    width: size,
    height: size,
    fonts,
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}

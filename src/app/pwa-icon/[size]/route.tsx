import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";

const SIZES = new Set(["180", "192", "512"]);

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
        background: brand.themeColor,
      }}
    >
      <div
        style={{
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: size,
          border: `${size * 0.09}px solid ${brand.accentColor}`,
        }}
      />
    </div>,
    { width: size, height: size },
  );
}

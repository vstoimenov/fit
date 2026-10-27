import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { iconUrl } from "@/lib/site/icon-variant";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.backgroundColor,
    theme_color: brand.themeColor,
    lang: "bg",
    icons: [
      { src: iconUrl(192), sizes: "192x192", type: "image/png" },
      { src: iconUrl(512), sizes: "512x512", type: "image/png" },
      { src: iconUrl(512), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import { brand } from "@/lib/brand";
import { iconUrl } from "@/lib/site/icon-variant";

/**
 * A second web-app manifest for the owner: added to the home screen from any /admin page it
 * installs as its own app („Админ“, dark icon) next to the member app, opening straight in /admin.
 */
export function GET() {
  const manifest = {
    name: `${brand.name} · Админ`,
    short_name: "Админ",
    description: "Админ панелът на I AM STRONG",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: brand.themeColor,
    theme_color: brand.themeColor,
    lang: "bg",
    icons: [
      { src: iconUrl(192, "admin"), sizes: "192x192", type: "image/png" },
      { src: iconUrl(512, "admin"), sizes: "512x512", type: "image/png" },
      { src: iconUrl(512, "admin"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return Response.json(manifest, {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}

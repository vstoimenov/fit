import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brand } from "@/lib/brand";

/**
 * The app icon: „I AM" (Manrope) over a handwritten „Strong" (Bad Script) on powder — the logo
 * stacked for a square. Bad Script is not bundled: it is fetched once from Google Fonts (TTF, which
 * the OG renderer can read) and cached for the life of the process; without it the mark falls back
 * to Manrope, so the icon never fails to render.
 */
const manrope = readFile(join(process.cwd(), "public", "fonts", "manrope-800.ttf"));
manrope.catch(() => undefined);

let badScript: Promise<ArrayBuffer | null> | undefined;

async function fetchBadScript(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch("https://fonts.googleapis.com/css2?family=Bad+Script&display=swap", {
      // A plain user agent makes Google answer with TTF instead of WOFF2.
      headers: { "user-agent": "Mozilla/5.0" },
      cache: "force-cache",
    }).then((r) => (r.ok ? r.text() : ""));
    const url = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/.exec(css)?.[1];
    if (!url) return null;
    const res = await fetch(url, { cache: "force-cache" });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function loadIconFonts() {
  badScript ??= fetchBadScript();
  const [sans, script] = await Promise.all([manrope, badScript]);
  const fonts = [{ name: "Manrope", data: sans, weight: 800 as const, style: "normal" as const }];
  if (script)
    fonts.push({ name: "Bad Script", data: Buffer.from(script), weight: 800, style: "normal" });
  return { fonts, hasScript: script !== null };
}

const scriptFamily = (hasScript: boolean) => (hasScript ? "Bad Script" : "Manrope");

/** Full-bleed square for the home screen (iOS rounds it, Android masks it). */
export function HomeScreenIcon({ size, hasScript }: { size: number; hasScript: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: brand.accentColor,
        color: brand.themeColor,
        lineHeight: 1,
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: "Manrope",
          fontWeight: 800,
          fontSize: size * 0.15,
          letterSpacing: size * 0.012,
          marginBottom: size * 0.02,
        }}
      >
        I AM
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: scriptFamily(hasScript),
          fontWeight: 800,
          // Android may mask the icon to a circle: keep the word inside the central 80 %.
          fontSize: hasScript ? size * 0.3 : size * 0.24,
          letterSpacing: hasScript ? 0 : -size * 0.01,
        }}
      >
        Strong
      </div>
    </div>
  );
}

/** Tiny browser-tab mark: the handwritten „S" on a rounded powder square. */
export function FaviconMark({ size, hasScript }: { size: number; hasScript: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: brand.accentColor,
        color: brand.themeColor,
        borderRadius: size * 0.22,
        fontFamily: scriptFamily(hasScript),
        fontWeight: 800,
        fontSize: hasScript ? size * 0.78 : size * 0.62,
        lineHeight: 1,
        paddingBottom: hasScript ? size * 0.06 : 0,
      }}
    >
      S
    </div>
  );
}

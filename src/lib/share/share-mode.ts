export type ShareMode = "files" | "text" | "download";

/** How this browser can share the image: as a file, as text only, or not at all (download). */
export function pickShareMode(
  nav: { share?: unknown; canShare?: (data: { files: File[] }) => boolean },
  file: File,
): ShareMode {
  if (typeof nav.share !== "function") return "download";
  try {
    if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) return "files";
  } catch {
    // Some browsers throw on unsupported data instead of returning false.
  }
  return "text";
}

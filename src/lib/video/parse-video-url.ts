export type VideoProvider = "youtube" | "vimeo" | "bunny";

export interface VideoRef {
  provider: VideoProvider;
  id: string;
  embedUrl: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const BUNNY_HOSTS = new Set(["iframe.mediadelivery.net", "player.mediadelivery.net"]);

function youtube(id: string): VideoRef | null {
  if (!YT_ID.test(id)) return null;
  return {
    provider: "youtube",
    id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
  };
}

/** Turns any common YouTube / Vimeo / Bunny link into an embeddable reference, or null. */
export function parseVideoUrl(raw: string): VideoRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return parts[0] ? youtube(parts[0]) : null;

  if (YT_HOSTS.has(host)) {
    if (parts[0] === "watch") return youtube(url.searchParams.get("v") ?? "");
    if (["shorts", "embed", "live"].includes(parts[0] ?? "") && parts[1]) return youtube(parts[1]);
    return null;
  }

  if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
    const videoParts =
      host === "player.vimeo.com" ? parts.slice(parts[0] === "video" ? 1 : 0) : parts;
    const id = videoParts[0];
    if (!id || !/^\d+$/.test(id)) return null;
    const hash = videoParts[1] ?? url.searchParams.get("h");
    const query = hash && /^[A-Za-z0-9]+$/.test(hash) ? `?dnt=1&h=${hash}` : "?dnt=1";
    return { provider: "vimeo", id, embedUrl: `https://player.vimeo.com/video/${id}${query}` };
  }

  if (BUNNY_HOSTS.has(host)) {
    const [mode, library, guid] = parts;
    if ((mode !== "embed" && mode !== "play") || !library || !guid) return null;
    if (!/^\d+$/.test(library) || !/^[0-9a-f-]{36}$/i.test(guid)) return null;
    return {
      provider: "bunny",
      id: `${library}/${guid}`,
      embedUrl: `https://iframe.mediadelivery.net/embed/${library}/${guid}?responsive=true`,
    };
  }

  return null;
}

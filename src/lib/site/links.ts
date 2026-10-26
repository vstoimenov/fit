import { normalizeVideoInput, parseVideoUrl } from "@/lib/video/parse-video-url";

export interface SiteLinks {
  trainerVideoUrl: string;
  instagramUrl: string;
}

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);

/**
 * The admin "Сайт" card: the trainer video must be a link one of our players can embed, the
 * Instagram link must really be Instagram. Blank clears either. Links are stored with https://.
 */
export function parseSiteLinks(
  input: SiteLinks,
): { ok: true; links: SiteLinks } | { ok: false; message: string } {
  const video = input.trainerVideoUrl.trim();
  const instagram = input.instagramUrl.trim();
  const links: SiteLinks = { trainerVideoUrl: "", instagramUrl: "" };

  if (video) {
    if (!parseVideoUrl(video)) {
      return { ok: false, message: "Видеото трябва да е YouTube, Vimeo или Bunny линк." };
    }
    links.trainerVideoUrl = normalizeVideoInput(video);
  }
  if (instagram) {
    let url: URL;
    try {
      url = new URL(normalizeVideoInput(instagram));
    } catch {
      return { ok: false, message: "Instagram линкът не е валиден адрес." };
    }
    if (url.protocol !== "https:" || !INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) {
      return { ok: false, message: "Instagram линкът трябва да води към instagram.com." };
    }
    links.instagramUrl = url.toString();
  }
  return { ok: true, links };
}

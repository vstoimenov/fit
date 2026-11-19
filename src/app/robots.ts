import type { MetadataRoute } from "next";
import { serverEnv } from "@/env";

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Bingbot",
  "Applebot-Extended",
];

export default function robots(): MetadataRoute.Robots {
  const base = serverEnv.APP_URL.replace(/\/$/, "");
  const disallow = ["/app", "/admin", "/api", "/dev", "/trenirovka", "/auth"];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // Named explicitly so AI search (ChatGPT, Claude, Perplexity, Gemini, Copilot) can read and
      // cite the public pages; the member area stays closed to them as well.
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt"], disallow },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

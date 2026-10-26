import type { MetadataRoute } from "next";
import { serverEnv } from "@/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = serverEnv.APP_URL.replace(/\/$/, "");
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/landing`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/podari`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/start`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.2 },
  ];
}

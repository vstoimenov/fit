import type { MetadataRoute } from "next";
import { serverEnv } from "@/env";

export default function robots(): MetadataRoute.Robots {
  const base = serverEnv.APP_URL.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/api", "/dev", "/trenirovka", "/auth"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

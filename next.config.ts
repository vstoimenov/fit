import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The client router keeps a visited app page for 30 s, so switching tabs back and forth is
  // instant instead of a server render each time; server actions still revalidate on write.
  experimental: { staleTimes: { dynamic: 30 } },
  // The founders landing lived at /osnovatelki before it became /landing.
  redirects: async () => [{ source: "/osnovatelki", destination: "/landing", permanent: true }],
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// No "@/" imports: next.config.ts loads this file through SWC.

/**
 * Sent with every response. Defence in depth for an app that holds health data and an admin panel:
 * no framing (clickjacking), no MIME sniffing, no access to camera-free features we never use. The
 * CSP only covers framing, plugins and <base>: a script/style policy needs a report-only trial first.
 * The referrer stays the browser default (origin only across sites), which the YouTube player needs.
 */
export const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

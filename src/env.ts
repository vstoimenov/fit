// Relative import: next.config.ts may load this through SWC, which breaks nested "@/" aliases.
import { clientEnvSchema, parseEnv, serverEnvSchema, type ServerEnv } from "./lib/env-schema";

// NEXT_PUBLIC_* must be referenced literally so Next.js inlines them into the client bundle.
export const clientEnv = parseEnv(
  clientEnvSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GOOGLE_AUTH: process.env.NEXT_PUBLIC_GOOGLE_AUTH,
    NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
  },
  "client",
);

const isServer = typeof window === "undefined";

/** Server-only variables; any access in the browser throws. */
export const serverEnv: ServerEnv = isServer
  ? parseEnv(serverEnvSchema, process.env, "server")
  : new Proxy({} as ServerEnv, {
      get(_target, property) {
        throw new Error(`serverEnv.${String(property)} was accessed in the browser.`);
      },
    });

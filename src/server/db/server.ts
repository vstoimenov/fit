import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { clientEnv } from "@/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Session-bound client for server components, route handlers and actions. RLS applies.
 * One client per request: a layout and its page render in parallel, and separate clients would
 * each refresh an expiring session with the same refresh token (Supabase answers the second with
 * 409 "Too many concurrent token refresh requests").
 */
export const createServerSupabaseClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet)
              cookieStore.set(name, value, options);
          } catch {
            // Server Components cannot set cookies; the proxy refreshes the session instead.
          }
        },
      },
    },
  );
});

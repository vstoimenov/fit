"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/env";
import type { Database } from "@/lib/supabase/database.types";

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "@/env";
import type { Database } from "@/lib/supabase/database.types";

/** Service-role client: bypasses RLS. Only for trusted server code (visits, account deletion). */
export function createAdminSupabaseClient() {
  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

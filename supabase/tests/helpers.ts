import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type TypedClient = SupabaseClient<Database>;

interface LocalKeys {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

let cachedKeys: LocalKeys | undefined;

/** Keys of the stack under test: env vars in CI, `supabase status` locally. */
export function localKeys(): LocalKeys {
  if (cachedKeys) return cachedKeys;
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY) {
    cachedKeys = {
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    };
    return cachedKeys;
  }
  const raw = execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    env: { ...process.env, DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "/tmp/dockercfg" },
  });
  const status = JSON.parse(raw) as Record<string, string | undefined>;
  if (!status.API_URL || !status.ANON_KEY || !status.SERVICE_ROLE_KEY) {
    throw new Error("supabase status returned no keys. Is `pnpm db:start` running?");
  }
  cachedKeys = {
    url: status.API_URL,
    anonKey: status.ANON_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
  };
  return cachedKeys;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): TypedClient {
  const { url, serviceRoleKey } = localKeys();
  return createClient<Database>(url, serviceRoleKey, noSession);
}

export function anonClient(): TypedClient {
  const { url, anonKey } = localKeys();
  return createClient<Database>(url, anonKey, noSession);
}

export const TEST_PASSWORD = "test-password-123";

export interface TestUser {
  id: string;
  email: string;
}

export async function createUser(
  admin: TypedClient,
  label: string,
  opts: { name?: string } = {},
): Promise<TestUser> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: opts.name ? { name: opts.name } : undefined,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  return { id: data.user.id, email };
}

export async function signedInClient(user: TestUser): Promise<TypedClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: TEST_PASSWORD,
  });
  if (error) throw error;
  return client;
}

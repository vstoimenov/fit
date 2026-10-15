import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { TOTP } from "otpauth";
import type { Database } from "@/lib/supabase/database.types";

export type TypedClient = SupabaseClient<Database>;

interface LocalKeys {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

let cachedKeys: LocalKeys | undefined;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** These tests create users and promote admins with a service-role key: never run them against a real project. */
function assertLocalUrl(url: string): void {
  if (process.env.ALLOW_REMOTE_SUPABASE_TESTS === "1") return;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Refusing to run DB tests: "${url}" is not a valid URL.`);
  }
  if (!LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error(
      `Refusing to run DB tests against non-local Supabase host "${hostname}". ` +
        "Set ALLOW_REMOTE_SUPABASE_TESTS=1 only for a disposable stack.",
    );
  }
}

/** Keys of the stack under test: env vars in CI, `supabase status` locally. */
export function localKeys(): LocalKeys {
  if (cachedKeys) return cachedKeys;
  const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY) {
    assertLocalUrl(SUPABASE_URL);
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
  assertLocalUrl(status.API_URL);
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

type SubStatus = Database["public"]["Enums"]["subscription_status"];
type WorkoutInsert = Database["public"]["Tables"]["workouts"]["Insert"];

/** Gives a user a subscription row (default: active, manual). */
export async function grantAccess(
  admin: TypedClient,
  userId: string,
  status: SubStatus = "active",
  extra: { current_period_end?: string | null; grace_until?: string | null } = {},
): Promise<void> {
  const { error } = await admin
    .from("subscriptions")
    .upsert({ user_id: userId, provider: "manual", status, ...extra });
  if (error) throw error;
}

export async function freeWorkoutId(admin: TypedClient): Promise<string> {
  const { data, error } = await admin.from("workouts").select("id").eq("kind", "free").single();
  if (error || !data) throw error ?? new Error("seed has no free workout — run pnpm db:reset");
  return data.id;
}

/** Inserts a workout plus a YouTube media row; returns its id. */
export async function createWorkout(admin: TypedClient, fields: WorkoutInsert): Promise<string> {
  const { data, error } = await admin.from("workouts").insert(fields).select("id").single();
  if (error || !data) throw error ?? new Error("createWorkout failed");
  const media = await admin.from("workout_media").insert({
    workout_id: data.id,
    provider: "youtube",
    video_url: "https://youtu.be/ml6cT4AZdqI",
  });
  if (media.error) throw media.error;
  return data.id;
}

/** A user with role admin who has NOT passed the second factor (session at aal1). */
export async function createAal1Admin(
  admin: TypedClient,
  label: string,
): Promise<{ user: TestUser; db: TypedClient }> {
  const user = await createUser(admin, label);
  const { error } = await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
  if (error) throw error;
  return { user, db: await signedInClient(user) };
}

/** A real admin: role admin + enrolled and verified TOTP, so the session is aal2. */
export async function createAdminUser(
  admin: TypedClient,
  label: string,
): Promise<{ user: TestUser; db: TypedClient }> {
  const { user, db } = await createAal1Admin(admin, label);
  const { data: factor, error: enrollError } = await db.auth.mfa.enroll({ factorType: "totp" });
  if (enrollError || !factor) throw enrollError ?? new Error("mfa enroll returned nothing");
  const code = new TOTP({ secret: factor.totp.secret }).generate();
  const { error: verifyError } = await db.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (verifyError) throw verifyError;
  return { user, db };
}

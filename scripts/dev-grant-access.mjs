// Usage: node --env-file=.env.local scripts/dev-grant-access.mjs someone@example.test
import { createClient } from "@supabase/supabase-js";

const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL host "${host}" is not local.`);
  process.exit(1);
}

const [email] = process.argv.slice(2);
if (!email) {
  console.error(
    "Usage: node --env-file=.env.local scripts/dev-grant-access.mjs someone@example.test",
  );
  process.exit(1);
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);
const { data: profile, error } = await db.from("profiles").select("id").eq("email", email).single();
if (error) throw error;
const result = await db
  .from("subscriptions")
  .upsert({ user_id: profile.id, provider: "manual", status: "active" });
if (result.error) throw result.error;
console.log(`access granted to ${email}`);

// Usage: node --env-file=.env.local scripts/dev-grant-access.mjs someone@example.test
import { createClient } from "@supabase/supabase-js";

const [email] = process.argv.slice(2);
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

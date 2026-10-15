// Usage: node --env-file=.env.local scripts/make-admin.mjs someone@example.test
// Local only. On a hosted project run: update public.profiles set role = 'admin' where email = '…';
import { createClient } from "@supabase/supabase-js";

const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL host "${host}" is not local.`);
  process.exit(1);
}
const [email] = process.argv.slice(2);
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/make-admin.mjs someone@example.test");
  process.exit(1);
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);
const { data, error } = await db
  .from("profiles")
  .update({ role: "admin" })
  .eq("email", email)
  .select("id");
if (error) throw error;
if (!data.length) {
  console.error(`No profile with email ${email}.`);
  process.exit(1);
}
console.log(`${email} is now an admin.`);
console.log(
  "Set up TOTP right now: open /admin and scan the QR code — until a factor is verified the admin account is protected only by its password.",
);

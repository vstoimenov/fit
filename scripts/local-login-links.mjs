// Usage: node --env-file=.env.local scripts/local-login-links.mjs [email …]
// LOCAL ONLY: prints one-time sign-in links (no password) for local test accounts.
// Refuses to run against a hosted Supabase project.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid";
const host = new URL(supabaseUrl).hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL host "${host}" is not local.`);
  process.exit(1);
}
const appUrl = process.env.APP_URL ?? "http://localhost:3120";
const emails = process.argv.slice(2);
if (emails.length === 0) emails.push("klientka@example.test", "admin@example.test");

const db = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
for (const email of emails) {
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  if (error) {
    console.error(`${email}: ${error.message}`);
    continue;
  }
  const next = email.startsWith("admin") ? "/admin" : "/app";
  const link = new URL("/auth/callback", appUrl);
  link.searchParams.set("token_hash", data.properties.hashed_token);
  link.searchParams.set("type", "magiclink");
  link.searchParams.set("next", next);
  console.log(`${email}\n  ${link.href}\n`);
}
console.log(
  "Each link works once and expires in about an hour; run the script again for new ones.",
);

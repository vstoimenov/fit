// Usage: node --env-file=.env.local scripts/dev-set-duration.mjs 1
// Shortens free + starter workouts so the 70% unlock can be tested quickly. `pnpm db:reset` restores.
import { createClient } from "@supabase/supabase-js";

const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://invalid").hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to run: NEXT_PUBLIC_SUPABASE_URL host "${host}" is not local.`);
  process.exit(1);
}

const minutes = Number(process.argv[2] ?? 1);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);
const { error } = await db
  .from("workouts")
  .update({ duration_min: minutes })
  .in("kind", ["free", "starter"]);
if (error) throw error;
console.log(`free + starter workouts now last ${minutes} min`);

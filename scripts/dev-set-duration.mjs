// Usage: node --env-file=.env.local scripts/dev-set-duration.mjs 1
// Shortens free + starter workouts so the 70% unlock can be tested quickly. `pnpm db:reset` restores.
import { createClient } from "@supabase/supabase-js";

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

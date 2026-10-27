import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// PostgREST never needs TRUNCATE / REFERENCES / TRIGGER / MAINTAIN; they must not be granted to API roles.
// Checked through the local stack's own database container (never any other project's).
const DB_CONTAINER = "supabase_db_fit-platform";
const TABLES = [
  "profiles",
  "workouts",
  "workout_media",
  "plans",
  "subscriptions",
  "gift_vouchers",
  "push_sends",
  "push_subscriptions",
  "workout_completions",
  "workout_watches",
  "check_ins",
  "visits",
  "audit_log",
  "client_notes",
  "settings",
  "payment_events",
  "security_flags",
  "articles",
  "points_ledger",
  "rewards_given",
  "progress_photos",
  "food_entries",
  "nutrition_ai_calls",
  "meals",
  "menu_swaps",
  "meal_draft_calls",
  "challenges",
  "challenge_days",
  "challenge_participants",
  "challenge_ticks",
  "community_comments",
  "community_hearts",
  "community_posts",
  "community_reports",
  "leads",
  "live_attendance",
  "live_sessions",
];
const ROLES = ["anon", "authenticated"];
// MAINTAIN exists since Postgres 17 (VACUUM / ANALYZE / REINDEX / CLUSTER / REFRESH MATERIALIZED VIEW / LOCK).
const PRIVILEGES = ["TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"];

function psql(sql: string): string {
  return execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-tAc", sql], {
    encoding: "utf8",
    env: { ...process.env, DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? "/tmp/dockercfg" },
  }).trim();
}

describe("table privileges of API roles", () => {
  it("covers every table in public (no table is missed by the list)", () => {
    const actual = psql(
      "select string_agg(tablename, ',' order by tablename) from pg_tables where schemaname = 'public'",
    );
    expect(actual.split(",")).toEqual([...TABLES].sort());
  });

  it.each(ROLES)(
    "grants %s no TRUNCATE, REFERENCES, TRIGGER or MAINTAIN on any public table",
    (role) => {
      const granted: string[] = [];
      for (const table of TABLES) {
        for (const privilege of PRIVILEGES) {
          const has = psql(
            `select has_table_privilege('${role}', 'public.${table}', '${privilege}')`,
          );
          if (has !== "f") granted.push(`${role} ${privilege} on ${table} (=${has})`);
        }
      }
      expect(granted).toEqual([]);
    },
  );

  it("does not hand these privileges to API roles on tables created later", () => {
    const name = `priv_probe_${Date.now()}`;
    try {
      psql(`create table public.${name} (id int)`);
      const granted: string[] = [];
      for (const role of ROLES) {
        for (const privilege of PRIVILEGES) {
          const has = psql(
            `select has_table_privilege('${role}', 'public.${name}', '${privilege}')`,
          );
          if (has !== "f") granted.push(`${role} ${privilege}`);
        }
      }
      expect(granted).toEqual([]);
    } finally {
      psql(`drop table if exists public.${name}`);
    }
  });
});

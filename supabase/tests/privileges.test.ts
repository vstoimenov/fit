import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// PostgREST never needs TRUNCATE / REFERENCES / TRIGGER; they must not be granted to API roles.
// Checked through the local stack's own database container (never any other project's).
const DB_CONTAINER = "supabase_db_fit-platform";
const TABLES = [
  "profiles",
  "workouts",
  "workout_media",
  "plans",
  "subscriptions",
  "workout_completions",
  "check_ins",
  "visits",
];
const ROLES = ["anon", "authenticated"];
const PRIVILEGES = ["TRUNCATE", "REFERENCES", "TRIGGER"];

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

  it.each(ROLES)("grants %s no TRUNCATE, REFERENCES or TRIGGER on any public table", (role) => {
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
  });
});

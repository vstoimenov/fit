import { beforeAll, describe, expect, it } from "vitest";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import {
  adminClient,
  anonClient,
  createAal1Admin,
  createAdminUser,
  createUser,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

describe("profiles", () => {
  it("creates a profile with the signup name for every new user", async () => {
    const user = await createUser(admin, "boot", { name: "Мария" });
    const { data } = await admin
      .from("profiles")
      .select("name, role, level")
      .eq("id", user.id)
      .single();
    expect(data).toEqual({ name: "Мария", role: "client", level: "beginner" });
  });

  it("lets a user read and edit only her own profile", async () => {
    const a = await createUser(admin, "own-a");
    const b = await createUser(admin, "own-b");
    const db = await signedInClient(a);

    const { data: rows } = await db.from("profiles").select("id");
    expect(rows?.map((r) => r.id)).toEqual([a.id]);

    const { error } = await db.from("profiles").update({ name: "Ани" }).eq("id", a.id);
    expect(error).toBeNull();
    const { data: renamed } = await admin.from("profiles").select("name").eq("id", a.id).single();
    expect(renamed?.name).toBe("Ани");

    await db.from("profiles").update({ name: "hack" }).eq("id", b.id);
    const { data: other } = await admin.from("profiles").select("name").eq("id", b.id).single();
    expect(other?.name).toBe("");
  });

  const serverOnlyUpdates = [
    ["role", "admin"],
    ["starter_week_done_at", "2026-01-01T00:00:00.000Z"],
    ["email", "someone-else@example.test"],
    ["first_utm", { utm_source: "hack" }],
    ["fbclid", "hack"],
    ["gclid", "hack"],
    ["last_seen_at", "2026-01-01T00:00:00.000Z"],
    ["id", "00000000-0000-0000-0000-000000000000"],
    ["joined_at", "2020-01-01T00:00:00.000Z"],
  ] as const;

  it.each(serverOnlyUpdates)("refuses a user writing %s", async (column, value) => {
    const user = await createUser(admin, "esc");
    const db = await signedInClient(user);
    const { data: before } = await admin.from("profiles").select(column).eq("id", user.id).single();

    const { error } = await db
      .from("profiles")
      .update({ [column]: value } as TablesUpdate<"profiles">)
      .eq("id", user.id);
    expect(error?.code).toBe("42501");

    const { data: after } = await admin.from("profiles").select(column).eq("id", user.id).single();
    expect(after).toEqual(before);
  });

  it("hides profiles from anonymous visitors", async () => {
    const user = await createUser(admin, "anon-target");
    const { data: real } = await admin.from("profiles").select("id").eq("id", user.id);
    expect(real).toHaveLength(1);

    const { data, error } = await anonClient().from("profiles").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("lets an admin read every profile", async () => {
    const { db } = await createAdminUser(admin, "boss");
    const other = await createUser(admin, "seen");
    const { data } = await db.from("profiles").select("id").eq("id", other.id);
    expect(data).toHaveLength(1);
  });

  it("does not let an admin who skipped the second factor read another profile", async () => {
    const { db } = await createAal1Admin(admin, "boss-aal1");
    const other = await createUser(admin, "unseen");
    const { data, error } = await db.from("profiles").select("id").eq("id", other.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

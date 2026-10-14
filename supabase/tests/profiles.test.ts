import { beforeAll, describe, expect, it } from "vitest";
import { adminClient, anonClient, createUser, signedInClient, type TypedClient } from "./helpers";

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

    await db.from("profiles").update({ name: "hack" }).eq("id", b.id);
    const { data: other } = await admin.from("profiles").select("name").eq("id", b.id).single();
    expect(other?.name).toBe("");
  });

  it("refuses role escalation and server-only columns", async () => {
    const user = await createUser(admin, "esc");
    const db = await signedInClient(user);
    const { error: roleError } = await db
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", user.id);
    expect(roleError?.code).toBe("42501");
    const { error: starterError } = await db
      .from("profiles")
      .update({ starter_week_done_at: new Date().toISOString() })
      .eq("id", user.id);
    expect(starterError?.code).toBe("42501");
  });

  it("hides profiles from anonymous visitors", async () => {
    const { data } = await anonClient().from("profiles").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("lets an admin read every profile", async () => {
    const boss = await createUser(admin, "boss");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
    const other = await createUser(admin, "seen");
    const db = await signedInClient(boss);
    const { data } = await db.from("profiles").select("id").eq("id", other.id);
    expect(data).toHaveLength(1);
  });
});

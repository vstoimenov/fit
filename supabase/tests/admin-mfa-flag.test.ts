import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { adminAccess } from "@/server/admin/admin-access";
import {
  adminClient,
  anonClient,
  createAal1Admin,
  createAdminUser,
  createUser,
  createWorkout,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

async function setFlag(enabled: boolean): Promise<void> {
  const { error } = await admin
    .from("security_flags")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("key", "admin_mfa_required");
  if (error) throw error;
}

// The flag is global state in the shared database: always put it back so later tests see "required".
afterEach(async () => {
  await setFlag(true);
});

async function draftIsVisibleTo(db: TypedClient): Promise<boolean> {
  const draft = await createWorkout(admin, {
    title: "Чернова за флаг",
    kind: "regular",
    level: "pro",
    duration_min: 10,
    publish_at: null,
  });
  const { data } = await db.from("workouts").select("id").eq("id", draft);
  return data?.length === 1;
}

describe("admin MFA flag", () => {
  it("is on by default: an aal1 admin is not an admin", async () => {
    const { data: row } = await admin
      .from("security_flags")
      .select("enabled")
      .eq("key", "admin_mfa_required")
      .single();
    expect(row?.enabled).toBe(true);
    const { user, db } = await createAal1Admin(admin, "flag-on");
    const { data: isAdmin } = await db.rpc("is_admin");
    expect(isAdmin).toBe(false);
    expect(await draftIsVisibleTo(db)).toBe(false);
    expect(await adminAccess(db, user.id)).toBe("mfa_required");
  });

  it("lets an aal1 admin in while it is off", async () => {
    await setFlag(false);
    const { user, db } = await createAal1Admin(admin, "flag-off");
    const { data: isAdmin } = await db.rpc("is_admin");
    expect(isAdmin).toBe(true);
    expect(await draftIsVisibleTo(db)).toBe(true);
    expect(await adminAccess(db, user.id)).toBe("ok");
  });

  it("keeps an aal2 admin working in both states", async () => {
    const { user, db } = await createAdminUser(admin, "flag-aal2");
    expect(await adminAccess(db, user.id)).toBe("ok");
    await setFlag(false);
    expect(await adminAccess(db, user.id)).toBe("ok");
  });

  it("treats a missing row as required", async () => {
    const { error: delError } = await admin
      .from("security_flags")
      .delete()
      .eq("key", "admin_mfa_required");
    expect(delError).toBeNull();
    try {
      const { db } = await createAal1Admin(admin, "flag-missing");
      const { data: isAdmin } = await db.rpc("is_admin");
      expect(isAdmin).toBe(false);
      const { data: required } = await db.rpc("admin_mfa_required");
      expect(required).toBe(true);
    } finally {
      const { error } = await admin
        .from("security_flags")
        .upsert({ key: "admin_mfa_required", enabled: true });
      expect(error).toBeNull();
    }
  });

  it("never makes a client an admin", async () => {
    await setFlag(false);
    const user = await createUser(admin, "flag-client");
    const db = await signedInClient(user);
    const { data: isAdmin } = await db.rpc("is_admin");
    expect(isAdmin).toBe(false);
    expect(await adminAccess(db, user.id)).toBe("not_admin");
    expect(await draftIsVisibleTo(db)).toBe(false);
  });
});

describe("security_flags is closed to the app", () => {
  it("refuses reads and writes from signed-in users, even admins", async () => {
    await setFlag(false);
    const { db } = await createAdminUser(admin, "flag-closed");
    const read = await db.from("security_flags").select("*");
    expect(read.error).not.toBeNull();
    const write = await db
      .from("security_flags")
      .update({ enabled: true })
      .eq("key", "admin_mfa_required");
    expect(write.error).not.toBeNull();
    const insert = await db.from("security_flags").insert({ key: "x", enabled: true });
    expect(insert.error).not.toBeNull();
    const { data: row } = await admin
      .from("security_flags")
      .select("enabled")
      .eq("key", "admin_mfa_required")
      .single();
    expect(row?.enabled).toBe(false);
  });

  it("refuses anon", async () => {
    const anon = anonClient();
    const read = await anon.from("security_flags").select("*");
    expect(read.error).not.toBeNull();
    const rpc = await anon.rpc("admin_mfa_required");
    expect(rpc.error).not.toBeNull();
  });
});

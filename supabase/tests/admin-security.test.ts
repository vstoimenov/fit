import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createAal1Admin,
  createAdminUser,
  createUser,
  createWorkout,
  grantAccess,
  signedInClient,
  type TypedClient,
} from "./helpers";

let admin: TypedClient;
const day = 86_400_000;
const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

beforeAll(() => {
  admin = adminClient();
});

describe("is_admin requires the second factor", () => {
  it("gives an aal1 admin nothing beyond her own rows", async () => {
    const other = await createUser(admin, "sec-other");
    const { db } = await createAal1Admin(admin, "sec-aal1");
    const { data: profiles, error } = await db.from("profiles").select("id").eq("id", other.id);
    expect(error).toBeNull();
    expect(profiles).toEqual([]);
    const { data: isAdmin } = await db.rpc("is_admin");
    expect(isAdmin).toBe(false);
    const draft = await createWorkout(admin, {
      title: "Чернова",
      kind: "regular",
      level: "pro",
      duration_min: 10,
      publish_at: null,
    });
    const { data: drafts } = await db.from("workouts").select("id").eq("id", draft);
    expect(drafts).toEqual([]);
  });

  it("gives an aal2 admin every profile and drafts", async () => {
    const other = await createUser(admin, "sec-other2");
    const { db } = await createAdminUser(admin, "sec-aal2");
    const { data: isAdmin } = await db.rpc("is_admin");
    expect(isAdmin).toBe(true);
    const { data: profiles, error } = await db.from("profiles").select("id").eq("id", other.id);
    expect(error).toBeNull();
    expect(profiles).toHaveLength(1);
    const draft = await createWorkout(admin, {
      title: "Чернова 2",
      kind: "regular",
      level: "pro",
      duration_min: 10,
      publish_at: null,
    });
    const { data: drafts } = await db.from("workouts").select("id").eq("id", draft);
    expect(drafts).toHaveLength(1);
  });
});

describe("manual access", () => {
  async function hasAccess(userId: string): Promise<boolean> {
    const { data, error } = await admin.rpc("has_active_access", { uid: userId });
    expect(error).toBeNull();
    return data === true;
  }

  it("keeps an open-ended manual grant active", async () => {
    const user = await createUser(admin, "man-open");
    await grantAccess(admin, user.id);
    expect(await hasAccess(user.id)).toBe(true);
  });

  it("expires a manual grant at its end date", async () => {
    const live = await createUser(admin, "man-live");
    await grantAccess(admin, live.id, "active", { current_period_end: iso(day) });
    expect(await hasAccess(live.id)).toBe(true);
    const ended = await createUser(admin, "man-ended");
    await grantAccess(admin, ended.id, "active", { current_period_end: iso(-day) });
    expect(await hasAccess(ended.id)).toBe(false);
  });

  it("does not expire a paid active subscription on a stale period end (webhook lag)", async () => {
    const user = await createUser(admin, "paid-lag");
    const { error } = await admin.from("subscriptions").upsert({
      user_id: user.id,
      provider: "stripe",
      status: "active",
      current_period_end: iso(-day),
    });
    expect(error).toBeNull();
    expect(await hasAccess(user.id)).toBe(true);
  });
});

describe("profile email sync", () => {
  it("follows an auth email change", async () => {
    const user = await createUser(admin, "mail-sync");
    const next = `renamed-${Date.now()}@example.test`;
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      email: next,
      email_confirm: true,
    });
    expect(error).toBeNull();
    const { data } = await admin.from("profiles").select("email").eq("id", user.id).single();
    expect(data?.email).toBe(next);
  });
});

describe("subscription timestamps", () => {
  it("records created_at and accepts canceled_at", async () => {
    const user = await createUser(admin, "sub-ts");
    await grantAccess(admin, user.id);
    const canceledAt = iso(0);
    const { error } = await admin
      .from("subscriptions")
      .update({ canceled_at: canceledAt })
      .eq("user_id", user.id);
    expect(error).toBeNull();
    const { data } = await admin
      .from("subscriptions")
      .select("created_at, canceled_at")
      .eq("user_id", user.id)
      .single();
    expect(data?.created_at).not.toBeNull();
    expect(data?.canceled_at).not.toBeNull();
  });
});

describe("a client is unaffected", () => {
  it("still reads her own profile", async () => {
    const user = await createUser(admin, "sec-client");
    const db = await signedInClient(user);
    const { data } = await db.from("profiles").select("id");
    expect(data?.map((r) => r.id)).toEqual([user.id]);
  });
});

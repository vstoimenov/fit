import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createUser,
  signedInClient,
  type TestUser,
  type TypedClient,
} from "./helpers";

const BUCKET = "progress-photos";
// Smallest plausible JPEG: SOI, JFIF APP0, EOI.
const JPEG = Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

async function member(label: string): Promise<{ user: TestUser; db: TypedClient }> {
  const user = await createUser(admin, label);
  return { user, db: await signedInClient(user) };
}

const newPath = (uid: string) => `${uid}/${randomUUID()}.jpg`;

async function upload(db: TypedClient, path: string, contentType = "image/jpeg") {
  return db.storage.from(BUCKET).upload(path, JPEG, { contentType, upsert: false });
}

async function uploaded(m: { user: TestUser; db: TypedClient }): Promise<string> {
  const path = newPath(m.user.id);
  const { error } = await upload(m.db, path);
  if (error) throw error;
  return path;
}

async function objectExists(path: string): Promise<boolean> {
  const [folder, name] = path.split("/");
  const { data, error } = await admin.storage.from(BUCKET).list(folder, { search: name });
  if (error) throw error;
  return data.some((o) => o.name === name);
}

function addPhoto(db: TypedClient, path: string, takenOn = "2026-10-01") {
  return db.rpc("add_progress_photo", { p_path: path, p_taken_on: takenOn });
}

function sofiaToday(offsetDays = 0): string {
  const base = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(new Date());
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe("progress-photos bucket", () => {
  it("member uploads into her own folder and reads it back", async () => {
    const m = await member("pp-own");
    const path = newPath(m.user.id);
    const up = await upload(m.db, path);
    expect(up.error).toBeNull();
    const down = await m.db.storage.from(BUCKET).download(path);
    expect(down.error).toBeNull();
    expect(down.data?.size).toBe(JPEG.length);
  });

  it("member cannot upload, read or delete in another member's folder", async () => {
    const a = await member("pp-a");
    const b = await member("pp-b");
    const aPath = await uploaded(a);

    expect((await upload(b.db, newPath(a.user.id))).error).not.toBeNull();
    expect((await b.db.storage.from(BUCKET).download(aPath)).error).not.toBeNull();
    await b.db.storage.from(BUCKET).remove([aPath]);
    expect(await objectExists(aPath)).toBe(true);
  });

  it("anon cannot read", async () => {
    const m = await member("pp-anon");
    const path = await uploaded(m);
    expect((await anonClient().storage.from(BUCKET).download(path)).error).not.toBeNull();
    expect((await upload(anonClient(), newPath(m.user.id))).error).not.toBeNull();
  });

  it("bucket refuses png", async () => {
    const m = await member("pp-png");
    const { error } = await upload(m.db, `${m.user.id}/${randomUUID()}.png`, "image/png");
    expect(error).not.toBeNull();
  });

  it("bucket is private with a 5 MB jpeg-only limit", async () => {
    const { data, error } = await admin.storage.getBucket(BUCKET);
    expect(error).toBeNull();
    expect(data).toMatchObject({
      public: false,
      file_size_limit: 5242880,
      allowed_mime_types: ["image/jpeg"],
    });
  });
});

describe("add_progress_photo", () => {
  it("records her photo and is idempotent", async () => {
    const m = await member("pp-add");
    const path = await uploaded(m);
    const first = await addPhoto(m.db, path, "2026-10-01");
    expect(first.error).toBeNull();
    expect(first.data).toMatch(/^[0-9a-f-]{36}$/);

    const again = await addPhoto(m.db, path, "2026-10-02");
    expect(again.error).toBeNull();
    expect(again.data).toBe(first.data);

    const rows = await m.db.from("progress_photos").select("id, path, taken_on, user_id");
    expect(rows.error).toBeNull();
    expect(rows.data).toEqual([
      { id: first.data, path, taken_on: "2026-10-01", user_id: m.user.id },
    ]);
  });

  it("accepts today and the lower date bound", async () => {
    const m = await member("pp-bounds");
    expect((await addPhoto(m.db, await uploaded(m), sofiaToday())).error).toBeNull();
    expect((await addPhoto(m.db, await uploaded(m), "2000-01-01")).error).toBeNull();
  });

  it("refuses another member's folder", async () => {
    const a = await member("pp-ref-a");
    const b = await member("pp-ref-b");
    const aPath = await uploaded(a);
    const { error } = await addPhoto(b.db, aPath);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("22023");
  });

  it("refuses a path that does not match the pattern", async () => {
    const m = await member("pp-bad-path");
    for (const bad of [
      `${m.user.id}/x.jpg`,
      `${m.user.id}/${randomUUID()}.png`,
      `${m.user.id}/${randomUUID().toUpperCase()}.jpg`,
      `${m.user.id}/sub/${randomUUID()}.jpg`,
      `${m.user.id}/${randomUUID()}.jpg\n`,
    ]) {
      const { error } = await addPhoto(m.db, bad);
      expect(error, bad).not.toBeNull();
      expect(error?.code, bad).toBe("22023");
    }
  });

  it("refuses a path whose object does not exist", async () => {
    const m = await member("pp-no-object");
    const { error } = await addPhoto(m.db, newPath(m.user.id));
    expect(error?.code).toBe("P0002");
  });

  it("refuses dates in the future (Sofia) and before 2000", async () => {
    const m = await member("pp-dates");
    const path = await uploaded(m);
    const future = await addPhoto(m.db, path, sofiaToday(1));
    expect(future.error?.code).toBe("22023");
    const old = await addPhoto(m.db, path, "1999-12-31");
    expect(old.error?.code).toBe("22023");
    const none = await m.db.from("progress_photos").select("id");
    expect(none.data).toEqual([]);
  });

  it("refuses unauthenticated callers", async () => {
    const m = await member("pp-anon-rpc");
    const path = await uploaded(m);
    const { error } = await addPhoto(anonClient(), path);
    expect(error).not.toBeNull();
  });

  it("limits a member to 200 photos", async () => {
    const m = await member("pp-limit");
    const rows = Array.from({ length: 200 }, (_, i) => ({
      user_id: m.user.id,
      path: newPath(m.user.id),
      taken_on: "2026-09-01",
      created_at: new Date(Date.UTC(2026, 8, 1, 0, 0, i)).toISOString(),
    }));
    expect((await admin.from("progress_photos").insert(rows)).error).toBeNull();

    const { error } = await addPhoto(m.db, await uploaded(m));
    expect(error?.code).toBe("P0001");
    expect(error?.message).toContain("200");

    // An already recorded photo is still idempotent at the limit.
    const existing = await addPhoto(m.db, rows[0].path);
    expect(existing.error).toBeNull();
  });
});

describe("progress_photos table", () => {
  it("members see only their own rows; direct insert/update/delete are denied", async () => {
    const a = await member("pp-tbl-a");
    const b = await member("pp-tbl-b");
    const aPath = await uploaded(a);
    const bPath = await uploaded(b);
    const aId = (await addPhoto(a.db, aPath)).data as string;
    await addPhoto(b.db, bPath);

    const seen = await a.db.from("progress_photos").select("id, user_id");
    expect(seen.data).toEqual([{ id: aId, user_id: a.user.id }]);
    expect((await anonClient().from("progress_photos").select("id")).data ?? []).toEqual([]);

    const insert = await a.db
      .from("progress_photos")
      .insert({ user_id: a.user.id, path: newPath(a.user.id), taken_on: "2026-10-01" });
    expect(insert.error).not.toBeNull();

    await a.db.from("progress_photos").update({ taken_on: "2026-01-01" }).eq("id", aId);
    await a.db.from("progress_photos").delete().eq("id", aId);
    const row = await admin.from("progress_photos").select("taken_on").eq("id", aId).single();
    expect(row.data?.taken_on).toBe("2026-10-01");
  });
});

describe("delete_progress_photo", () => {
  it("deletes only her own row", async () => {
    const a = await member("pp-del-a");
    const b = await member("pp-del-b");
    const aId = (await addPhoto(a.db, await uploaded(a))).data as string;
    const bId = (await addPhoto(b.db, await uploaded(b))).data as string;

    expect((await a.db.rpc("delete_progress_photo", { p_id: bId })).error).toBeNull();
    const stillB = await admin.from("progress_photos").select("id").eq("id", bId);
    expect(stillB.data).toHaveLength(1);

    expect((await a.db.rpc("delete_progress_photo", { p_id: aId })).error).toBeNull();
    const goneA = await admin.from("progress_photos").select("id").eq("id", aId);
    expect(goneA.data).toEqual([]);
  });

  it("is not callable by anon", async () => {
    const { error } = await anonClient().rpc("delete_progress_photo", { p_id: randomUUID() });
    expect(error).not.toBeNull();
  });
});

describe("profile deletion", () => {
  it("cascades progress photo rows", async () => {
    const m = await member("pp-cascade");
    const id = (await addPhoto(m.db, await uploaded(m))).data as string;
    const del = await admin.auth.admin.deleteUser(m.user.id);
    expect(del.error).toBeNull();
    const rows = await admin.from("progress_photos").select("id").eq("id", id);
    expect(rows.data).toEqual([]);
  });
});

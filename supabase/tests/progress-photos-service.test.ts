import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import {
  deleteProgressPhoto,
  getProgressPhoto,
  listProgressPhotos,
  recordProgressPhoto,
  removeAllProgressPhotos,
} from "@/server/progress/photos";
import {
  adminClient,
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

/** Uploads a JPEG into her own folder and records it; returns the photo id and its path. */
async function addPhoto(
  m: { user: TestUser; db: TypedClient },
  takenOn: string,
): Promise<{ id: string; path: string }> {
  const path = `${m.user.id}/${randomUUID()}.jpg`;
  const up = await m.db.storage
    .from(BUCKET)
    .upload(path, JPEG, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw up.error;
  const id = await recordProgressPhoto(m.db, { path, takenOn });
  return { id, path };
}

async function objectNames(userId: string): Promise<string[]> {
  const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: 1000 });
  if (error) throw error;
  return data.map((o) => o.name);
}

function sofiaToday(offsetDays = 0): string {
  const base = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(new Date());
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

describe("listProgressPhotos", () => {
  it("lists newest taken_on first, then newest created_at, with signed URLs that fetch", async () => {
    const m = await member("ppsvc-list");
    const older = await addPhoto(m, "2026-09-01");
    const newerFirst = await addPhoto(m, "2026-10-01");
    const newerSecond = await addPhoto(m, "2026-10-01");
    const photos = await listProgressPhotos(m.db);
    expect(photos.map((p) => p.id)).toEqual([newerSecond.id, newerFirst.id, older.id]);
    expect(photos[2]).toMatchObject({ takenOn: "2026-09-01", path: older.path });
    expect(typeof photos[0].createdAt).toBe("string");
    for (const p of photos) {
      expect(p.url).toEqual(expect.stringContaining("/object/sign/progress-photos/"));
      const res = await fetch(p.url as string);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/jpeg");
    }
  });

  it("honours limit and returns the newest ones", async () => {
    const m = await member("ppsvc-limit");
    await addPhoto(m, "2026-08-01");
    const newest = await addPhoto(m, "2026-10-02");
    const photos = await listProgressPhotos(m.db, { limit: 1 });
    expect(photos.map((p) => p.id)).toEqual([newest.id]);
  });

  it("is empty for a member without photos and only shows her own", async () => {
    const a = await member("ppsvc-empty-a");
    const b = await member("ppsvc-empty-b");
    await addPhoto(b, "2026-10-01");
    expect(await listProgressPhotos(a.db)).toEqual([]);
  });

  it("gives url null for a photo whose object is gone", async () => {
    const m = await member("ppsvc-nourl");
    const gone = await addPhoto(m, "2026-09-01");
    const kept = await addPhoto(m, "2026-10-01");
    const rm = await admin.storage.from(BUCKET).remove([gone.path]);
    expect(rm.error).toBeNull();
    const photos = await listProgressPhotos(m.db);
    expect(photos.find((p) => p.id === gone.id)?.url).toBeNull();
    expect(photos.find((p) => p.id === kept.id)?.url).not.toBeNull();
  });
});

describe("getProgressPhoto", () => {
  it("returns her own photo with a working URL", async () => {
    const m = await member("ppsvc-get");
    const p = await addPhoto(m, "2026-10-01");
    const photo = await getProgressPhoto(m.db, p.id);
    expect(photo).toMatchObject({ id: p.id, takenOn: "2026-10-01", path: p.path });
    expect((await fetch(photo?.url as string)).status).toBe(200);
  });

  it("returns null for another member's photo, an unknown id and a malformed id", async () => {
    const a = await member("ppsvc-get-a");
    const b = await member("ppsvc-get-b");
    const p = await addPhoto(a, "2026-10-01");
    expect(await getProgressPhoto(b.db, p.id)).toBeNull();
    expect(await getProgressPhoto(a.db, randomUUID())).toBeNull();
    expect(await getProgressPhoto(a.db, "not-a-uuid")).toBeNull();
    expect(await getProgressPhoto(a.db, "")).toBeNull();
  });
});

describe("recordProgressPhoto", () => {
  it("rejects a future date with a Bulgarian VALIDATION message", async () => {
    const m = await member("ppsvc-future");
    const path = `${m.user.id}/${randomUUID()}.jpg`;
    await m.db.storage.from(BUCKET).upload(path, JPEG, { contentType: "image/jpeg" });
    await expect(recordProgressPhoto(m.db, { path, takenOn: sofiaToday(2) })).rejects.toMatchObject(
      {
        name: "AppError",
        code: "INVALID",
        userMessage: "Датата трябва да е до днес.",
      },
    );
  });

  it("maps a path in another member's folder, a missing object and a signed-out client to the generic message", async () => {
    const a = await member("ppsvc-rec-a");
    const b = await member("ppsvc-rec-b");
    const generic = {
      name: "AppError",
      code: "INVALID",
      userMessage: "Снимката не се качи. Опитай пак.",
    };
    await expect(
      recordProgressPhoto(b.db, {
        path: `${a.user.id}/${randomUUID()}.jpg`,
        takenOn: "2026-10-01",
      }),
    ).rejects.toMatchObject(generic);
    await expect(
      recordProgressPhoto(b.db, {
        path: `${b.user.id}/${randomUUID()}.jpg`,
        takenOn: "2026-10-01",
      }),
    ).rejects.toMatchObject(generic);
    const signedOut = (await import("./helpers")).anonClient();
    await expect(
      recordProgressPhoto(signedOut, {
        path: `${b.user.id}/${randomUUID()}.jpg`,
        takenOn: "2026-10-01",
      }),
    ).rejects.toMatchObject(generic);
  });

  it("passes the database's Bulgarian limit message through at 200 photos", async () => {
    const m = await member("ppsvc-cap");
    const rows = Array.from({ length: 200 }, (_, i) => ({
      user_id: m.user.id,
      path: `${m.user.id}/${randomUUID()}.jpg`,
      taken_on: "2026-01-01",
      created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    }));
    const seeded = await admin.from("progress_photos").insert(rows);
    expect(seeded.error).toBeNull();
    const path = `${m.user.id}/${randomUUID()}.jpg`;
    await m.db.storage.from(BUCKET).upload(path, JPEG, { contentType: "image/jpeg" });
    await expect(recordProgressPhoto(m.db, { path, takenOn: "2026-10-01" })).rejects.toMatchObject({
      name: "AppError",
      code: "INVALID",
      userMessage: "Можеш да пазиш до 200 снимки. Изтрий някоя стара, за да добавиш нова.",
    });
  });
});

describe("deleteProgressPhoto", () => {
  it("removes the stored object and the row", async () => {
    const m = await member("ppsvc-del");
    const p = await addPhoto(m, "2026-10-01");
    await deleteProgressPhoto(m.db, p.id);
    expect(await objectNames(m.user.id)).toEqual([]);
    const { data } = await admin.from("progress_photos").select("id").eq("id", p.id);
    expect(data).toEqual([]);
  });

  it("is NOT_FOUND for another member's photo and leaves her object and row alone", async () => {
    const a = await member("ppsvc-del-a");
    const b = await member("ppsvc-del-b");
    const p = await addPhoto(a, "2026-10-01");
    await expect(deleteProgressPhoto(b.db, p.id)).rejects.toMatchObject({
      name: "AppError",
      code: "NOT_FOUND",
    });
    expect(await objectNames(a.user.id)).toEqual([`${p.path.split("/")[1]}`]);
    const { data } = await admin.from("progress_photos").select("id").eq("id", p.id);
    expect(data).toHaveLength(1);
  });

  it("is NOT_FOUND for an unknown or malformed id", async () => {
    const m = await member("ppsvc-del-unknown");
    await expect(deleteProgressPhoto(m.db, randomUUID())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteProgressPhoto(m.db, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("removeAllProgressPhotos", () => {
  it("removes every object in her folder, across pages, even without rows", async () => {
    const m = await member("ppsvc-removeall");
    const names = Array.from({ length: 105 }, () => `${randomUUID()}.jpg`);
    for (let i = 0; i < names.length; i += 15) {
      await Promise.all(
        names.slice(i, i + 15).map(async (n) => {
          const { error } = await admin.storage
            .from(BUCKET)
            .upload(`${m.user.id}/${n}`, JPEG, { contentType: "image/jpeg" });
          if (error) throw error;
        }),
      );
    }
    expect(await objectNames(m.user.id)).toHaveLength(105);
    await removeAllProgressPhotos(admin, m.user.id);
    expect(await objectNames(m.user.id)).toEqual([]);
  });

  it("does not touch another member's objects and is fine with nothing to remove", async () => {
    const a = await member("ppsvc-removeall-a");
    const b = await member("ppsvc-removeall-b");
    const p = await addPhoto(b, "2026-10-01");
    await removeAllProgressPhotos(admin, a.user.id);
    expect(await objectNames(b.user.id)).toEqual([p.path.split("/")[1]]);
  });

  it("throws when the storage list fails", async () => {
    const failing = new Proxy(admin, {
      get(target, prop) {
        if (prop === "storage") {
          return {
            from: () => ({
              list: async () => ({ data: null, error: new Error("list down") }),
            }),
          };
        }
        const v = Reflect.get(target, prop, target);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    await expect(removeAllProgressPhotos(failing, randomUUID())).rejects.toThrow();
  });
});

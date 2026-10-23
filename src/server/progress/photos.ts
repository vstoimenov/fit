import { AppError } from "@/lib/app-error";
import { MAX_PHOTOS } from "@/lib/progress-photos/geometry";
import type { TypedClient } from "@/server/db/types";

const BUCKET = "progress-photos";
const URL_TTL_SECONDS = 3600;
const REMOVE_PAGE = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UPLOAD_FAILED = "Снимката не се качи. Опитай пак.";
const DATE_IN_FUTURE = "Датата трябва да е до днес.";

export type ProgressPhoto = {
  id: string;
  takenOn: string;
  createdAt: string;
  path: string;
  /** Signed link valid for an hour; null when it could not be created (e.g. the object is gone). */
  url: string | null;
};

type Row = { id: string; path: string; taken_on: string; created_at: string };
const COLUMNS = "id, path, taken_on, created_at";

/** One signing call for all rows; a path that fails to sign gets `url: null` instead of failing the list. */
async function withUrls(db: TypedClient, rows: Row[]): Promise<ProgressPhoto[]> {
  const urls = new Map<string, string>();
  if (rows.length > 0) {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrls(
      rows.map((r) => r.path),
      URL_TTL_SECONDS,
    );
    if (error) throw new Error(`sign progress photos failed: ${error.message}`);
    for (const entry of data) {
      if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    takenOn: r.taken_on,
    createdAt: r.created_at,
    path: r.path,
    url: urls.get(r.path) ?? null,
  }));
}

/** Her photos, newest first (by the day taken, then by when it was added). RLS limits this to her own. */
export async function listProgressPhotos(
  db: TypedClient,
  opts: { limit?: number } = {},
): Promise<ProgressPhoto[]> {
  const { data, error } = await db
    .from("progress_photos")
    .select(COLUMNS)
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? MAX_PHOTOS);
  if (error) throw new Error(`load progress photos failed: ${error.message}`);
  return withUrls(db, data);
}

async function getRow(db: TypedClient, id: string): Promise<Row | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await db
    .from("progress_photos")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`load progress photo failed: ${error.message}`);
  return data;
}

/** One of her photos, or null for a malformed id or a photo that is not hers (or does not exist). */
export async function getProgressPhoto(db: TypedClient, id: string): Promise<ProgressPhoto | null> {
  const row = await getRow(db, id);
  if (!row) return null;
  const [photo] = await withUrls(db, [row]);
  return photo;
}

/**
 * Records a photo she has already uploaded; returns its id. The database checks the path, the stored
 * object, the date and the cap. Its failures become messages that are safe to show: only the
 * (Bulgarian) limit message is passed through, never raw database text.
 */
export async function recordProgressPhoto(
  db: TypedClient,
  input: { path: string; takenOn: string },
): Promise<string> {
  const { data, error } = await db.rpc("add_progress_photo", {
    p_path: input.path,
    p_taken_on: input.takenOn,
  });
  if (!error) return data;
  switch (error.code) {
    case "P0001":
      throw new AppError("INVALID", error.message);
    case "22023":
      throw new AppError(
        "INVALID",
        error.message === "invalid photo date" ? DATE_IN_FUTURE : UPLOAD_FAILED,
      );
    case "42501":
    case "P0002":
      throw new AppError("INVALID", UPLOAD_FAILED);
    default:
      throw new Error(`record progress photo failed: ${error.message}`);
  }
}

/**
 * Deletes one of her photos: the stored object first (a failure there throws and leaves the row, so the
 * photo stays visible and can be retried), then the row.
 */
export async function deleteProgressPhoto(db: TypedClient, id: string): Promise<void> {
  const photo = await getRow(db, id);
  if (!photo) throw new AppError("NOT_FOUND", "Снимката не е намерена.");
  const removed = await db.storage.from(BUCKET).remove([photo.path]);
  if (removed.error) throw new Error(`remove progress photo failed: ${removed.error.message}`);
  const { error } = await db.rpc("delete_progress_photo", { p_id: id });
  if (error) throw new Error(`delete progress photo failed: ${error.message}`);
}

/**
 * Removes every stored photo object under `{userId}/` with the service-role client. Lists the folder
 * itself rather than trusting the rows, which may already be gone. Each pass removes the page it listed,
 * so the next pass starts again at the front; a pass that removes nothing is an error, never a loop.
 */
export async function removeAllProgressPhotos(admin: TypedClient, userId: string): Promise<void> {
  const bucket = admin.storage.from(BUCKET);
  for (;;) {
    const { data: page, error } = await bucket.list(userId, { limit: REMOVE_PAGE, offset: 0 });
    if (error) throw new Error(`list progress photos failed: ${error.message}`);
    const paths = page.filter((o) => o.id !== null).map((o) => `${userId}/${o.name}`);
    if (paths.length === 0) return;
    const { data: removed, error: removeError } = await bucket.remove(paths);
    if (removeError) throw new Error(`remove progress photos failed: ${removeError.message}`);
    if (removed.length === 0) throw new Error("remove progress photos failed: nothing was removed");
  }
}

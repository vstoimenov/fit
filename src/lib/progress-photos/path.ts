/** Storage object path for a photo: `{user_id}/{uuid}.jpg`. */
export function photoPath(userId: string, id: string): string {
  return `${userId}/${id}.jpg`;
}

/** True when `path` is a well-formed photo path under this user's own folder. */
export function isOwnPhotoPath(userId: string, path: string): boolean {
  const uid = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^${uid}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`,
  );
  return pattern.test(path);
}

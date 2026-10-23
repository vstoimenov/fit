import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isOwnPhotoPath, photoPath } from "./path";

const uid = "3f6c2a1e-9b7d-4c8e-8a2f-1d2e3f4a5b6c";

describe("photoPath", () => {
  it("builds the user-scoped object path", () => {
    expect(photoPath(uid, "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")).toBe(
      `${uid}/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.jpg`,
    );
  });
});

describe("isOwnPhotoPath", () => {
  it("accepts a path built by photoPath for the same user", () => {
    expect(isOwnPhotoPath(uid, photoPath(uid, randomUUID()))).toBe(true);
  });

  it("rejects a path under another user's prefix", () => {
    const other = "7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
    expect(isOwnPhotoPath(uid, photoPath(other, randomUUID()))).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(isOwnPhotoPath(uid, `${uid}/../${randomUUID()}.jpg`)).toBe(false);
  });

  it("rejects uppercase hex in the file name", () => {
    expect(isOwnPhotoPath(uid, `${uid}/0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D.jpg`)).toBe(false);
  });

  it("rejects other extensions", () => {
    expect(isOwnPhotoPath(uid, `${uid}/${randomUUID()}.png`)).toBe(false);
  });

  it("rejects a missing extension", () => {
    expect(isOwnPhotoPath(uid, `${uid}/${randomUUID()}`)).toBe(false);
  });

  it("rejects an extra folder level", () => {
    expect(isOwnPhotoPath(uid, `${uid}/extra/${randomUUID()}.jpg`)).toBe(false);
  });
});

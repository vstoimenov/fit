import { beforeAll, describe, expect, it } from "vitest";
import { adminAccess } from "@/server/admin/admin-access";
import {
  adminClient,
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

describe("adminAccess", () => {
  it("separates clients, half-signed-in admins and real admins", async () => {
    const client = await createUser(admin, "guard-client");
    expect(await adminAccess(await signedInClient(client), client.id)).toBe("not_admin");
    const half = await createAal1Admin(admin, "guard-half");
    expect(await adminAccess(half.db, half.user.id)).toBe("mfa_required");
    const full = await createAdminUser(admin, "guard-full");
    expect(await adminAccess(full.db, full.user.id)).toBe("ok");
  });
});

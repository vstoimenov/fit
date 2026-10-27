import { describe, expect, it } from "vitest";
import { adminClient, anonClient, createUser, signedInClient } from "./helpers";

const admin = adminClient();

describe("keep-warm ping", () => {
  it("runs every five minutes from pg_cron", async () => {
    const { data, error } = await admin.rpc("warm_cron_status");
    expect(error).toBeNull();
    expect(data).toMatchObject({ scheduled: true, schedule: "*/5 * * * *", active: true });
  });

  it("is not callable by visitors or members", async () => {
    const anon = await anonClient().rpc("run_warm_ping");
    expect(anon.error?.code).toBe("42501");
    const member = await signedInClient(await createUser(admin, "warm")).then((db) =>
      db.rpc("run_warm_ping"),
    );
    expect(member.error?.code).toBe("42501");
    const status = await anonClient().rpc("warm_cron_status");
    expect(status.error?.code).toBe("42501");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { TypedClient } from "@/server/db/types";
import { hashIp, submitLead } from "./submit";

const lead = { name: "Мария", email: "maria@example.com", marketing: false };

function fakeDb(result: { error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { db: { rpc } as unknown as TypedClient, rpc };
}

describe("submitLead", () => {
  it("calls submit_lead with the lead and the ip hash", async () => {
    const { db, rpc } = fakeDb({ error: null });
    const res = await submitLead(db, lead, "abc", "free-workout");
    expect(res).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_lead", {
      p_name: "Мария",
      p_email: "maria@example.com",
      p_marketing: false,
      p_source: "free-workout",
      p_ip_hash: "abc",
    });
  });

  it("maps the rate limit to its own error", async () => {
    const { db } = fakeDb({ error: { message: "rate_limited" } });
    expect(await submitLead(db, lead, "abc", "free-workout")).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });

  it("maps any other failure to failed", async () => {
    const { db } = fakeDb({ error: { message: "boom" } });
    expect(await submitLead(db, lead, null, "free-workout")).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

describe("hashIp", () => {
  it("is a salted sha256 hex and null without an ip", () => {
    const a = hashIp("1.2.3.4", "salt-salt-salt-salt");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("1.2.3.4", "other-salt-other-salt")).not.toBe(a);
    expect(hashIp(null, "salt-salt-salt-salt")).toBeNull();
  });
});

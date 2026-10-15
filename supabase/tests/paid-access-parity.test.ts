import { beforeAll, describe, expect, it } from "vitest";
import { paidAccessLive } from "@/lib/subscription-text";
import { adminClient, createUser, type TypedClient } from "./helpers";

let admin: TypedClient;

beforeAll(() => {
  admin = adminClient();
});

const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

type Row = {
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  current_period_end: string | null;
  grace_until: string | null;
};

// Offsets are in hours from now; the margin keeps the check stable while the test runs.
const cases: [string, () => Row][] = [
  [
    "active, period in the future",
    () => ({ status: "active", current_period_end: at(48), grace_until: null }),
  ],
  [
    "active, period already over",
    () => ({ status: "active", current_period_end: at(-48), grace_until: null }),
  ],
  [
    "active, no period end",
    () => ({ status: "active", current_period_end: null, grace_until: null }),
  ],
  ["trialing", () => ({ status: "trialing", current_period_end: at(48), grace_until: null })],
  [
    "past_due, grace in the future",
    () => ({ status: "past_due", current_period_end: at(-24), grace_until: at(48) }),
  ],
  [
    "past_due, grace over",
    () => ({ status: "past_due", current_period_end: at(-72), grace_until: at(-24) }),
  ],
  [
    "past_due, no grace",
    () => ({ status: "past_due", current_period_end: at(-24), grace_until: null }),
  ],
  [
    "canceled, period in the future",
    () => ({ status: "canceled", current_period_end: at(48), grace_until: null }),
  ],
  [
    "canceled, period over",
    () => ({ status: "canceled", current_period_end: at(-48), grace_until: null }),
  ],
  [
    "canceled, no period end",
    () => ({ status: "canceled", current_period_end: null, grace_until: null }),
  ],
  ["none", () => ({ status: "none", current_period_end: null, grace_until: null })],
];

describe("paidAccessLive matches has_active_access for paid rows", () => {
  it.each(cases)("%s", async (label, make) => {
    const user = await createUser(admin, "parity");
    const row = make();
    const { error } = await admin
      .from("subscriptions")
      .insert({ user_id: user.id, provider: "stripe", ...row });
    expect(error, label).toBeNull();
    const { data } = await admin.rpc("has_active_access", { uid: user.id });
    expect(paidAccessLive({ ...row, provider: "stripe" }, new Date())).toBe(data === true);
  });
});

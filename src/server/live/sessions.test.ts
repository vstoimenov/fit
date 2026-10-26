import { describe, expect, it } from "vitest";
import { pickNextSession } from "./sessions";

const s = (id: string, startsAt: string, durationMin = 60) => ({ id, startsAt, durationMin });

describe("pickNextSession", () => {
  it("prefers a session that is running, else the soonest upcoming one", () => {
    const now = new Date("2026-10-30T17:30:00Z");
    const rows = [
      s("past", "2026-10-30T15:00:00Z"),
      s("running", "2026-10-30T17:00:00Z"),
      s("later", "2026-10-31T17:00:00Z"),
      s("soon", "2026-10-30T19:00:00Z"),
    ];
    expect(pickNextSession(rows, now)?.id).toBe("running");
    expect(
      pickNextSession(
        rows.filter((r) => r.id !== "running"),
        now,
      )?.id,
    ).toBe("soon");
    expect(pickNextSession([s("past", "2026-10-30T15:00:00Z")], now)).toBeNull();
  });
});

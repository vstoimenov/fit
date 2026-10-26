import { describe, expect, it } from "vitest";
import { JOIN_OPENS_MIN_BEFORE, joinOpensAt, liveState } from "./window";

const session = { startsAt: "2026-10-30T17:00:00Z", durationMin: 60 };

describe("liveState", () => {
  it("opens 15 minutes before the start and closes when the session ends", () => {
    expect(JOIN_OPENS_MIN_BEFORE).toBe(15);
    expect(liveState(session, new Date("2026-10-30T16:44:59Z"))).toBe("upcoming");
    expect(liveState(session, new Date("2026-10-30T16:45:00Z"))).toBe("open");
    expect(liveState(session, new Date("2026-10-30T17:59:59Z"))).toBe("open");
    expect(liveState(session, new Date("2026-10-30T18:00:00Z"))).toBe("ended");
  });
  it("tells when the door opens", () => {
    expect(joinOpensAt(session).toISOString()).toBe("2026-10-30T16:45:00.000Z");
  });
});

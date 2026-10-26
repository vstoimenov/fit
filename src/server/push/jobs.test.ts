import { describe, expect, it } from "vitest";
import { dueReminders, isCronAuthorized, reminderBody } from "./jobs";

const now = new Date("2026-10-27T16:05:00Z"); // 18:05 in Sofia, 17:05 in Vienna

describe("dueReminders", () => {
  it("picks members whose local hour matches, who have not trained or been reminded today", () => {
    const rows = [
      {
        id: "sofia-due",
        timezone: "Europe/Sofia",
        push_hour: 18,
        push_reminded_on: null,
        trained_today: false,
      },
      {
        id: "vienna-not-yet",
        timezone: "Europe/Vienna",
        push_hour: 18,
        push_reminded_on: null,
        trained_today: false,
      },
      {
        id: "already-reminded",
        timezone: "Europe/Sofia",
        push_hour: 18,
        push_reminded_on: "2026-10-27",
        trained_today: false,
      },
      {
        id: "trained",
        timezone: "Europe/Sofia",
        push_hour: 18,
        push_reminded_on: null,
        trained_today: true,
      },
      {
        id: "off",
        timezone: "Europe/Sofia",
        push_hour: null,
        push_reminded_on: null,
        trained_today: false,
      },
      {
        id: "reminded-yesterday",
        timezone: "Europe/Sofia",
        push_hour: 18,
        push_reminded_on: "2026-10-26",
        trained_today: false,
      },
    ];
    expect(dueReminders(rows, now).map((r) => r.id)).toEqual(["sofia-due", "reminded-yesterday"]);
  });

  it("returns the local date to stamp as reminded", () => {
    const [due] = dueReminders(
      [
        {
          id: "x",
          timezone: "Europe/Sofia",
          push_hour: 18,
          push_reminded_on: null,
          trained_today: false,
        },
      ],
      now,
    );
    expect(due?.localDate).toBe("2026-10-27");
  });
});

describe("isCronAuthorized", () => {
  it("accepts only the bearer secret", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(isCronAuthorized("Bearer wrong", "s3cret")).toBe(false);
    expect(isCronAuthorized(null, "s3cret")).toBe(false);
    expect(isCronAuthorized("Bearer s3cret", undefined)).toBe(false);
  });
});

describe("reminderBody", () => {
  it("stays short and personal-data free", () => {
    expect(reminderBody().length).toBeLessThanOrEqual(160);
  });
});

import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";

describe("buildIcs", () => {
  it("writes a one-event calendar in UTC with CRLF lines and escaped text", () => {
    const ics = buildIcs(
      {
        id: "6d1f0d4e-0000-4000-8000-000000000001",
        title: "На живо: кор, гръб; дишане",
        description: "Вземи постелка.\nБез уреди.",
        startsAt: "2026-10-30T17:00:00Z",
        durationMin: 45,
      },
      "https://iamstrong.bg",
    );
    expect(ics.endsWith("\r\n")).toBe(true);
    const lines = ics.trimEnd().split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("DTSTART:20261030T170000Z");
    expect(lines).toContain("DTEND:20261030T174500Z");
    expect(lines).toContain("SUMMARY:На живо: кор\\, гръб\; дишане");
    expect(lines).toContain("DESCRIPTION:Вземи постелка.\\nБез уреди.");
    expect(lines).toContain("UID:6d1f0d4e-0000-4000-8000-000000000001@iamstrong.bg");
    expect(lines).toContain("URL:https://iamstrong.bg/app");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
  });
});

import { describe, expect, it } from "vitest";
import { leadsCsv } from "./leads";

describe("leadsCsv", () => {
  it("writes a BOM, a header and RFC 4180 quoted rows", () => {
    const csv = leadsCsv([
      {
        id: "1",
        name: 'Мария "М"',
        email: "m@x.bg",
        source: "free-workout",
        marketing_consent_at: null,
        created_at: "2026-10-26T10:00:00Z",
      },
      {
        id: "2",
        name: "Ива, Петрова",
        email: "iva@x.bg",
        source: "free-workout",
        marketing_consent_at: "2026-10-26T11:00:00Z",
        created_at: "2026-10-26T11:00:00Z",
      },
    ]);
    expect(csv.startsWith("﻿name,email,source,marketing,created_at\r\n")).toBe(true);
    expect(csv).toContain('"Мария ""М""",m@x.bg,free-workout,no,2026-10-26T10:00:00Z');
    expect(csv).toContain('"Ива, Петрова",iva@x.bg,free-workout,yes,2026-10-26T11:00:00Z');
  });

  it("neutralises spreadsheet formulas in names", () => {
    const row = {
      id: "3",
      email: "f@x.bg",
      source: "free-workout",
      marketing_consent_at: null,
      created_at: "2026-10-26T12:00:00Z",
    };
    const csv = leadsCsv([
      { ...row, name: '=HYPERLINK("http://evil")' },
      { ...row, name: "-5" },
      { ...row, name: "+1" },
      { ...row, name: "@cmd" },
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")",f@x.bg`);
    expect(csv).toContain("'-5,f@x.bg");
    expect(csv).toContain("'+1,f@x.bg");
    expect(csv).toContain("'@cmd,f@x.bg");
  });

  it("is just the header for no rows", () => {
    expect(leadsCsv([])).toBe("﻿name,email,source,marketing,created_at\r\n");
  });
});

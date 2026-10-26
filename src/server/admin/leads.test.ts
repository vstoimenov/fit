import { describe, expect, it } from "vitest";
import type { TypedClient } from "@/server/db/types";
import { leadsCsv, listAllLeads, listLeads } from "./leads";

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

/** Answers every query with `rows` and records the chain. */
function fakeDb(rows: unknown[], calls: string[] = []) {
  const chain: Record<string, unknown> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(",")})`);
      return chain;
    };
  for (const name of ["from", "select", "order", "range", "ilike"]) chain[name] = record(name);
  chain.then = (resolve: (r: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  return { db: chain as unknown as TypedClient, calls };
}

const row = (i: number) => ({
  id: String(i),
  name: "N",
  email: `${i}@x.bg`,
  source: "free-workout",
  marketing_consent_at: null,
  created_at: "2026-10-26T10:00:00Z",
});

describe("listLeads pages", () => {
  it("asks for one row more than the page to know whether there is a next page", async () => {
    const { db, calls } = fakeDb([row(1), row(2), row(3)]);
    const page = await listLeads(db, null, { page: 2, pageSize: 2 });
    expect(calls).toContain("range(2,4)");
    expect(page.rows.map((r) => r.id)).toEqual(["1", "2"]);
    expect(page.hasMore).toBe(true);
  });

  it("reports the last page", async () => {
    const { db } = fakeDb([row(1)]);
    expect((await listLeads(db, "x", { page: 1, pageSize: 2 })).hasMore).toBe(false);
  });
});

describe("listAllLeads", () => {
  it("gets past PostgREST's 1000-row cap (inclusive range, capped response)", async () => {
    const all = Array.from({ length: 1500 }, (_, i) => row(i + 1));
    const db = {
      from: () => ({
        select: () => {
          const q = {
            order: () => q,
            range: async (from: number, to: number) => ({
              data: all.slice(from, Math.min(to + 1, from + 1000)),
              error: null,
            }),
          };
          return q;
        },
      }),
    } as unknown as TypedClient;
    expect((await listAllLeads(db)).length).toBe(1500);
  });

  it("stops at the first short page", async () => {
    const ranges: string[] = [];
    const db = {
      from: () => ({
        select: () => {
          const q = {
            order: () => q,
            range: async (from: number, to: number) => {
              ranges.push(`${from}-${to}`);
              return { data: [row(1), row(2)], error: null };
            },
          };
          return q;
        },
      }),
    } as unknown as TypedClient;
    expect((await listAllLeads(db)).map((r) => r.id)).toEqual(["1", "2"]);
    expect(ranges).toEqual(["0-999"]);
  });
});

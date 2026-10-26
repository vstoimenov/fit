import type { TypedClient } from "@/server/db/types";

export type Lead = {
  id: string;
  name: string;
  email: string;
  source: string;
  marketing_consent_at: string | null;
  created_at: string;
};

const COLUMNS = "id, name, email, source, marketing_consent_at, created_at";

export const LEADS_PAGE_SIZE = 100;

/**
 * One page of leads, newest first; `q` narrows by e-mail (case-insensitive substring). Asks for
 * one row beyond the page so the caller knows whether a next page exists. RLS: admins only.
 */
export async function listLeads(
  db: TypedClient,
  q: string | null,
  { page = 1, pageSize = LEADS_PAGE_SIZE }: { page?: number; pageSize?: number } = {},
): Promise<{ rows: Lead[]; hasMore: boolean }> {
  const from = (Math.max(1, page) - 1) * pageSize;
  let query = db
    .from("leads")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    // Tie-breaker: equal timestamps must not shuffle rows between pages.
    .order("id")
    .range(from, from + pageSize);
  if (q) query = query.ilike("email", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const { data, error } = await query;
  if (error) throw new Error(`load leads failed: ${error.message}`);
  return { rows: data.slice(0, pageSize), hasMore: data.length > pageSize };
}

const EXPORT_PAGE = 1000;
const EXPORT_MAX_PAGES = 100;

/**
 * Every lead, for the CSV export. PostgREST answers at most `max_rows` (1000) per request, so this
 * asks for exactly 1000 at a time (an inclusive range) and stops at the first short page.
 */
export async function listAllLeads(db: TypedClient): Promise<Lead[]> {
  const all: Lead[] = [];
  for (let page = 0; page < EXPORT_MAX_PAGES; page++) {
    const from = page * EXPORT_PAGE;
    const { data, error } = await db
      .from("leads")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + EXPORT_PAGE - 1);
    if (error) throw new Error(`export leads failed: ${error.message}`);
    all.push(...data);
    if (data.length < EXPORT_PAGE) break;
  }
  return all;
}

/** Leads created in the last 7 days, for the dashboard tile. */
export async function countRecentLeads(db: TypedClient, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await db
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (error) throw new Error(`count leads failed: ${error.message}`);
  return count ?? 0;
}

function cell(raw: string): string {
  // A leading = + - @ tab or CR would be run as a formula by Excel; a quote neutralises it.
  const value = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Cyrillic names correctly. */
export function leadsCsv(rows: Lead[]): string {
  const lines = rows.map((r) =>
    [r.name, r.email, r.source, r.marketing_consent_at ? "yes" : "no", r.created_at]
      .map(cell)
      .join(","),
  );
  return "﻿" + ["name,email,source,marketing,created_at", ...lines].join("\r\n") + "\r\n";
}

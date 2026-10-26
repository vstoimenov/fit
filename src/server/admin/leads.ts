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

/** Newest leads first; `q` narrows by e-mail (case-insensitive substring). RLS: admins only. */
export async function listLeads(db: TypedClient, q: string | null, limit = 500): Promise<Lead[]> {
  let query = db
    .from("leads")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (q) query = query.ilike("email", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const { data, error } = await query;
  if (error) throw new Error(`load leads failed: ${error.message}`);
  return data;
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

function cell(value: string): string {
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

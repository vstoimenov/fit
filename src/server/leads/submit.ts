import { createHash } from "node:crypto";
import type { TypedClient } from "@/server/db/types";
import type { LeadInput } from "./schema";

export type LeadSource = "free-workout";

export type SubmitLeadResult =
  { ok: true; inserted: boolean } | { ok: false; error: "rate_limited" | "failed" };

/** Salted sha256 of the visitor's IP, kept only to rate-limit the form; null without an IP. */
export function hashIp(ip: string | null, salt: string): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Stores (or refreshes) a lead through the `submit_lead` RPC. The function is callable only with
 * the service role, so `db` is the admin client from a server action — never a browser client.
 * `inserted` is false when the e-mail was already known (the row is refreshed, no e-mail is sent).
 */
export async function submitLead(
  db: TypedClient,
  input: LeadInput,
  ipHash: string | null,
  source: LeadSource,
): Promise<SubmitLeadResult> {
  const { data, error } = await db.rpc("submit_lead", {
    p_name: input.name,
    p_email: input.email,
    p_marketing: input.marketing,
    p_source: source,
    // The generated RPC types take a string; SQL treats "" as "no ip".
    p_ip_hash: ipHash ?? "",
  });
  if (!error) return { ok: true, inserted: data === true };
  if (error.message.includes("rate_limited")) return { ok: false, error: "rate_limited" };
  console.error("submit_lead failed:", error.message);
  return { ok: false, error: "failed" };
}

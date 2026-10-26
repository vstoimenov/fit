import { createHash } from "node:crypto";
import type { TypedClient } from "@/server/db/types";
import type { LeadInput } from "./schema";

export type LeadSource = "free-workout";

export type SubmitLeadResult = { ok: true } | { ok: false; error: "rate_limited" | "failed" };

/** Salted sha256 of the visitor's IP, kept only to rate-limit the form; null without an IP. */
export function hashIp(ip: string | null, salt: string): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Stores (or refreshes) a lead through the `submit_lead` RPC, which anon may call. */
export async function submitLead(
  db: TypedClient,
  input: LeadInput,
  ipHash: string | null,
  source: LeadSource,
): Promise<SubmitLeadResult> {
  const { error } = await db.rpc("submit_lead", {
    p_name: input.name,
    p_email: input.email,
    p_marketing: input.marketing,
    p_source: source,
    p_ip_hash: ipHash,
  });
  if (!error) return { ok: true };
  if (error.message.includes("rate_limited")) return { ok: false, error: "rate_limited" };
  console.error("submit_lead failed:", error.message);
  return { ok: false, error: "failed" };
}

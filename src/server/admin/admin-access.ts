import type { TypedClient } from "@/server/db/types";

/**
 * Role admin AND a session that passed TOTP (aal2). The DB enforces the same through is_admin().
 * Kept free of env-reading imports so the DB integration tests can load it.
 */
export async function adminAccess(
  db: TypedClient,
  userId: string,
): Promise<"ok" | "not_admin" | "mfa_required"> {
  const { data: profile, error } = await db
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`load role failed: ${error.message}`);
  if (profile.role !== "admin") return "not_admin";
  const { data: aal, error: aalError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) throw new Error(`load assurance level failed: ${aalError.message}`);
  return aal.currentLevel === "aal2" ? "ok" : "mfa_required";
}

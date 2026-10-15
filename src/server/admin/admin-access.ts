import type { TypedClient } from "@/server/db/types";

/** The database flag `admin_mfa_required` (default on; a missing row counts as on). */
async function mfaFlagIsOff(db: TypedClient): Promise<boolean> {
  const { data: required, error } = await db.rpc("admin_mfa_required");
  if (error) throw new Error(`load mfa flag failed: ${error.message}`);
  return required === false;
}

/**
 * True when this session has not passed TOTP but the database flag lets it in anyway (test mode).
 * False for an aal2 session and while the flag is on.
 */
export async function adminMfaBypassed(db: TypedClient): Promise<boolean> {
  const { data: aal, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new Error(`load assurance level failed: ${error.message}`);
  return aal.currentLevel !== "aal2" && (await mfaFlagIsOff(db));
}

/**
 * Role admin AND a session that passed TOTP (aal2), unless the database flag turned that off for
 * testing. The DB enforces the same through is_admin().
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
  if (aal.currentLevel === "aal2") return "ok";
  return (await mfaFlagIsOff(db)) ? "ok" : "mfa_required";
}

export type MfaPageDecision = "not_found" | "form" | "admin";

/**
 * What /admin/mfa shows. The form appears when the second factor is required, or when an admin
 * who is let in without it (test-mode flag off) explicitly asks to enrol (`?enrol=1`); otherwise
 * the page is a detour and she goes straight to the admin.
 */
export function mfaPageDecision(input: {
  access: "ok" | "not_admin" | "mfa_required";
  aal: string | null | undefined;
  enrol: boolean;
}): MfaPageDecision {
  if (input.access === "not_admin") return "not_found";
  if (input.access === "mfa_required") return "form";
  if (input.aal === "aal2") return "admin";
  return input.enrol ? "form" : "admin";
}

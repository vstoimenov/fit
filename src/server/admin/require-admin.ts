import "server-only";

import { AppError } from "@/lib/app-error";
import { requireUser } from "@/server/auth/require-user";
import { adminAccess } from "./admin-access";

export { adminAccess };

/** For admin pages and server actions. */
export async function requireAdmin() {
  const { user, supabase } = await requireUser();
  const access = await adminAccess(supabase, user.id);
  if (access === "not_admin") throw new AppError("FORBIDDEN", "Нямаш достъп.");
  if (access === "mfa_required")
    throw new AppError("MFA_REQUIRED", "Потвърди входа с код от приложението за автентикация.");
  return { user, supabase };
}

import "server-only";

import { randomUUID } from "node:crypto";
import { WALKIN_EMAIL_DOMAIN } from "@/lib/studio/rules";
import type { TypedClient } from "@/server/db/types";
import { studioJoinSchema } from "./join";

/**
 * „Нова клиентка“ at the door: a real profile with name and phone but no way to sign in yet
 * (placeholder e-mail, no password). The caller must already have passed requireAdmin().
 */
export async function createWalkIn(
  service: TypedClient,
  raw: unknown,
): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const parsed = studioJoinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const { name, phone } = parsed.data;
  const { data, error } = await service.auth.admin.createUser({
    email: `walkin-${randomUUID()}@${WALKIN_EMAIL_DOMAIN}`,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) throw new Error(`create walk-in failed: ${error?.message}`);
  const { error: profileError } = await service
    .from("profiles")
    .update({ phone, studio_client: true })
    .eq("id", data.user.id);
  if (profileError) throw new Error(`save walk-in profile failed: ${profileError.message}`);
  return { ok: true, userId: data.user.id };
}

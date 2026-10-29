import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { isPlaceholderEmail } from "@/lib/studio/rules";
import type { TypedClient } from "@/server/db/types";
import { studioErrorMessage } from "./errors";

const INVITE_DAYS = 14;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A one-time link for a walk-in to set her own e-mail and password (service role). */
export async function createStudioInvite(
  service: TypedClient,
  userId: string,
  createdBy: string | null,
  now = new Date(),
): Promise<string> {
  const { data: profile, error } = await service
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();
  if (error) throw new Error(`load invite profile failed: ${error.message}`);
  if (!isPlaceholderEmail(profile.email)) throw new Error("profile already has a login");
  const token = randomBytes(32).toString("base64url");
  const { error: insertError } = await service.from("studio_invites").insert({
    token_hash: hash(token),
    user_id: userId,
    created_by: createdBy,
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + INVITE_DAYS * 86_400_000).toISOString(),
  });
  if (insertError) throw new Error(`create invite failed: ${insertError.message}`);
  return token;
}

const claimSchema = z.object({
  email: z.string().trim().toLowerCase().email("Провери имейла"),
  password: z.string().min(10, "Паролата трябва да е поне 10 символа."),
});

/**
 * Takes the invite (once), then puts her e-mail and password on the walk-in profile. If the auth
 * update fails the invite is released again, so she can retry with another e-mail.
 */
export async function claimStudioInvite(
  service: TypedClient,
  token: string,
  raw: unknown,
  now = new Date(),
): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  const parsed = claimSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const invalid = { ok: false as const, message: studioErrorMessage("invalid invite") };
  const { email, password } = parsed.data;
  // Auth answers a taken e-mail with a generic error; profiles mirror every login's e-mail.
  const { count, error: takenError } = await service
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"));
  if (takenError) throw new Error(`check e-mail failed: ${takenError.message}`);
  if (count) return { ok: false, message: "Вече има профил с този имейл. Влез от „Имам профил“." };
  const { data: invite, error } = await service
    .from("studio_invites")
    .update({ used_at: now.toISOString() })
    .eq("token_hash", hash(token))
    .is("used_at", null)
    .gt("expires_at", now.toISOString())
    .select("token_hash, user_id, profiles!studio_invites_user_id_fkey(email)")
    .maybeSingle();
  if (error) throw new Error(`take invite failed: ${error.message}`);
  if (!invite || !invite.profiles || !isPlaceholderEmail(invite.profiles.email)) return invalid;

  const { error: authError } = await service.auth.admin.updateUserById(invite.user_id, {
    email,
    password,
    email_confirm: true,
  });
  if (authError) {
    await service
      .from("studio_invites")
      .update({ used_at: null })
      .eq("token_hash", invite.token_hash);
    return { ok: false, message: "Не успяхме да запазим профила. Опитай отново." };
  }
  return { ok: true, email };
}

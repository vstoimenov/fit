import "server-only";

import { z } from "zod";
import type { TypedClient } from "@/server/db/types";

const PHONE = /^\+?[0-9 ]{8,16}$/;

/** The short sign-up for in-person trainings: name and phone (same rule as `profiles.phone`). */
export const studioJoinSchema = z.object({
  name: z.string().trim().min(2, "Напиши името си").max(60, "До 60 знака"),
  phone: z.string().trim().regex(PHONE, "Остави телефон, за да ти пише Аксения при промяна."),
});

export async function joinStudio(
  db: TypedClient,
  raw: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = studioJoinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  const { error } = await db.rpc("studio_join", {
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
  });
  if (error) throw new Error(`join studio failed: ${error.message}`);
  return { ok: true };
}

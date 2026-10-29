import "server-only";

import { z } from "zod";
import { cardWarning, isPlaceholderEmail, STUDIO_CARDS } from "@/lib/studio/rules";
import type { TypedClient } from "@/server/db/types";
import { CARD_COLUMNS, currentCard, toCard, type StudioCard } from "./booking";
import { studioErrorMessage } from "./errors";

type Result<T = object> = ({ ok: true } & T) | { ok: false; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** „Дай карта“: card type, start date (may be in the past) and visits already used in the notebook. */
export const grantCardSchema = z
  .object({
    userId: z.string().uuid(),
    kind: z.enum(["card8", "card12"]),
    startsOn: z.string().regex(ISO_DATE, "Избери начална дата"),
    usedBefore: z.coerce.number().int().min(0).default(0),
  })
  .refine((v) => v.usedBefore < STUDIO_CARDS[v.kind].visits, {
    message: "Използваните са повече от посещенията на картата",
    path: ["usedBefore"],
  });

const adjustSchema = z.object({
  cardId: z.string().uuid(),
  delta: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, "Въведи колко посещения да добавиш или махнеш"),
  reason: z.string().trim().min(2, "Напиши причина").max(200, "До 200 знака"),
});

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Невалидни данни.";

export async function grantStudioCard(
  db: TypedClient,
  raw: unknown,
): Promise<Result<{ moved: number }>> {
  const parsed = grantCardSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const v = parsed.data;
  const { data, error } = await db.rpc("studio_grant_card", {
    p_user_id: v.userId,
    p_kind: v.kind,
    p_starts_on: v.startsOn,
    p_used_before: v.usedBefore,
  });
  if (error) return { ok: false, message: studioErrorMessage(error.message) };
  return { ok: true, moved: (data as { moved: number }).moved };
}

export async function voidStudioCard(db: TypedClient, cardId: string): Promise<Result> {
  const { error } = await db.rpc("studio_void_card", { p_card_id: cardId });
  if (error) return { ok: false, message: studioErrorMessage(error.message) };
  return { ok: true };
}

export async function adjustStudioCard(db: TypedClient, raw: unknown): Promise<Result> {
  const parsed = adjustSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { error } = await db.rpc("studio_adjust_card", {
    p_card_id: parsed.data.cardId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, message: studioErrorMessage(error.message) };
  return { ok: true };
}

export interface StudioClientRow {
  userId: string;
  name: string;
  phone: string | null;
  /** null while she is a walk-in without her own login */
  email: string | null;
  card: StudioCard | null;
  warning: "low" | "expiring" | null;
  hasLogin: boolean;
}

/** Everyone who trains on site, with the card a booking today would use (admin RLS). */
export async function listStudioClients(
  db: TypedClient,
  today: string,
): Promise<StudioClientRow[]> {
  const [profiles, cards] = await Promise.all([
    db
      .from("profiles")
      .select("id, name, phone, email")
      .eq("studio_client", true)
      .order("name")
      .limit(1000),
    db.from("studio_card_status").select(CARD_COLUMNS).limit(5000),
  ]);
  if (profiles.error) throw new Error(`list studio clients failed: ${profiles.error.message}`);
  if (cards.error) throw new Error(`list studio cards failed: ${cards.error.message}`);
  const byUser = new Map<string, StudioCard[]>();
  for (const row of cards.data) {
    const list = byUser.get(row.user_id!) ?? [];
    list.push(toCard(row));
    byUser.set(row.user_id!, list);
  }
  return profiles.data.map((p) => {
    const card = currentCard(byUser.get(p.id) ?? [], today);
    const hasLogin = !isPlaceholderEmail(p.email);
    return {
      userId: p.id,
      name: p.name,
      phone: p.phone,
      email: hasLogin ? p.email : null,
      card,
      warning: card && !card.voided ? cardWarning(card, today) : null,
      hasLogin,
    };
  });
}

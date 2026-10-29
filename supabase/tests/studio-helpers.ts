import { addDays, utcToZoned } from "@/lib/admin/time";
import type { TypedClient } from "./helpers";

export const hours = (n: number) => new Date(Date.now() + n * 3_600_000).toISOString();
export const sofiaToday = () => utcToZoned(new Date().toISOString()).date;

/** A dated training without a weekly slot. */
export async function studioSession(
  admin: TypedClient,
  startsAt: string,
  capacity = 10,
): Promise<string> {
  const { data, error } = await admin
    .from("studio_sessions")
    .insert({ starts_at: startsAt, duration_min: 60, title: "Кръгова тренировка", capacity })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/** A card written directly with the service role (Task 4 adds the admin RPC). */
export async function studioCard(
  admin: TypedClient,
  userId: string,
  opts: {
    kind?: "card8" | "card12";
    startsOn?: string;
    endsOn?: string;
    usedBefore?: number;
    voided?: boolean;
  } = {},
): Promise<string> {
  const kind = opts.kind ?? "card8";
  const startsOn = opts.startsOn ?? addDays(sofiaToday(), -1);
  const { data, error } = await admin
    .from("studio_cards")
    .insert({
      user_id: userId,
      kind,
      visits: kind === "card8" ? 8 : 12,
      starts_on: startsOn,
      ends_on: opts.endsOn ?? addDays(startsOn, kind === "card8" ? 27 : 41),
      used_before: opts.usedBefore ?? 0,
      voided_at: opts.voided ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function remaining(admin: TypedClient, cardId: string): Promise<number> {
  const { data, error } = await admin
    .from("studio_card_status")
    .select("remaining")
    .eq("id", cardId)
    .single();
  if (error) throw error;
  return data.remaining!;
}

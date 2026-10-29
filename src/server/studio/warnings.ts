import "server-only";

import { cardWarning, dayMonth } from "@/lib/studio/rules";
import type { TypedClient } from "@/server/db/types";
import { sendToUsers, type PushTransport } from "@/server/push/send";

/**
 * Daily nudges about her card: one visit left, or the card ending within 3 days. Each card is
 * stamped when told, so the hourly cron sends each nudge once.
 */
export async function sendStudioWarnings(
  service: TypedClient,
  transport: PushTransport,
  today: string,
): Promise<{ low: number; expiring: number }> {
  const { data, error } = await service
    .from("studio_card_status")
    .select("id, user_id, ends_on, remaining, warned_low_at, warned_expiry_at")
    .is("voided_at", null)
    .gte("ends_on", today)
    .lte("starts_on", today)
    .gt("remaining", 0);
  if (error) throw new Error(`load studio cards for warnings failed: ${error.message}`);
  let low = 0;
  let expiring = 0;
  for (const card of data) {
    const kind = cardWarning({ remaining: card.remaining!, endsOn: card.ends_on! }, today);
    if (kind === null) continue;
    const column = kind === "low" ? "warned_low_at" : "warned_expiry_at";
    if (card[column] !== null) continue;
    // "low" wins for a single visit left, so the expiry text always has two or more.
    // Claim before sending: a second cron run that overlaps finds the stamp and skips.
    const { data: claimed, error: claimError } = await service
      .from("studio_cards")
      .update(
        kind === "low"
          ? { warned_low_at: new Date().toISOString() }
          : { warned_expiry_at: new Date().toISOString() },
      )
      .eq("id", card.id!)
      .is(column, null)
      .select("id");
    if (claimError) throw new Error(`stamp card warning failed: ${claimError.message}`);
    if (claimed.length === 0) continue;
    const body =
      kind === "low"
        ? "Остава ти 1 посещение по картата. Поднови я при Аксения."
        : `Картата ти изтича на ${dayMonth(card.ends_on!)}. Остават ти ${card.remaining} посещения.`;
    await sendToUsers(
      service,
      [card.user_id!],
      { title: "Твоята карта", body, url: "/na-myasto", tag: `studio-card-${kind}-${card.id}` },
      transport,
    );
    if (kind === "low") low++;
    else expiring++;
  }
  return { low, expiring };
}

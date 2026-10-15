import type { Database } from "@/lib/supabase/database.types";

type Status = Database["public"]["Enums"]["subscription_status"];

const DATE = new Intl.DateTimeFormat("bg-BG", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Sofia",
});

/** What the profile page tells her about her subscription. `hasAccess` (my_access) is the only access rule. */
export function subscriptionText(
  hasAccess: boolean,
  sub: { status: Status; current_period_end: string | null } | null,
): string {
  if (!hasAccess) {
    return sub?.status === "canceled" || sub?.status === "past_due"
      ? "Абонаментът ти е приключил"
      : "Нямаш активен абонамент";
  }
  switch (sub?.status) {
    case "active":
      return "Активен";
    case "trialing":
      return "Пробен период";
    case "past_due":
      return "Има проблем с плащането, но още имаш достъп";
    case "canceled":
      return sub.current_period_end
        ? `Отказан · достъп до ${DATE.format(new Date(sub.current_period_end))}`
        : "Отказан · достъпът още е активен";
    default:
      return "Достъп до всички тренировки";
  }
}

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Sofia",
});

const WILL_END_STATUSES: ReadonlySet<Status> = new Set(["active", "trialing", "past_due"]);

/**
 * „Абонаментът ще приключи на dd.mm.yyyy" for a live subscription that will not renew, else null.
 * A canceled one already shows its date in subscriptionText, and a past date means it has ended.
 */
export function endNotice(
  sub: {
    status: Status;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  } | null,
  now: Date = new Date(),
): string | null {
  if (!sub?.cancel_at_period_end || !sub.current_period_end) return null;
  if (!WILL_END_STATUSES.has(sub.status)) return null;
  const end = new Date(sub.current_period_end);
  if (end.getTime() <= now.getTime()) return null;
  const [day, month, year] = SHORT_DATE.formatToParts(end)
    .filter((part) => part.type !== "literal")
    .map((part) => part.value);
  return `Абонаментът ще приключи на ${day}.${month}.${year}`;
}

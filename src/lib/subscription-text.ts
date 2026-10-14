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

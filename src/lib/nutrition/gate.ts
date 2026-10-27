import type { PushSupport } from "@/lib/push/support";

export type GateStep = "done" | "todo" | "n/a";
export type NutritionGate = {
  open: boolean;
  install: GateStep | "in_app";
  push: GateStep | "blocked";
};

/**
 * Хранене opens for a member once the club is on her phone's home screen and notifications are on:
 * the diary only works if she comes back to it, and the reminders are what bring her back. A computer
 * is not asked to install; an in-app browser (Instagram, Facebook) cannot install, so it is told to
 * open the site in Safari or Chrome. The owner is never blocked, and without push keys on the site
 * the notifications step is skipped (nothing could be sent anyway).
 */
export function nutritionGate(input: {
  isAdmin: boolean;
  mobile: boolean;
  standalone: boolean;
  inApp: boolean;
  pushKey: boolean;
  pushOn: boolean;
  pushSupport: PushSupport;
}): NutritionGate {
  const install: NutritionGate["install"] = !input.mobile
    ? "n/a"
    : input.standalone
      ? "done"
      : input.inApp
        ? "in_app"
        : "todo";
  const push: NutritionGate["push"] = !input.pushKey
    ? "n/a"
    : input.pushOn
      ? "done"
      : input.pushSupport === "denied"
        ? "blocked"
        : "todo";
  const open =
    input.isAdmin ||
    ((install === "done" || install === "n/a") && (push === "done" || push === "n/a"));
  return { open, install, push };
}

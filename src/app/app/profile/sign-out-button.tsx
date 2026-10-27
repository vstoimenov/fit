"use client";

import { useState } from "react";
import { clearDraft } from "@/components/onboarding/storage";
import { buttonClass } from "@/components/ui/button";
import { unsubscribePushAction } from "./push-actions";
import { signOut } from "./actions";

/**
 * Signing out on a shared phone must not leave her reminders on it: this device's push subscription
 * is dropped first (best effort, never blocks the sign-out). The onboarding draft holds health
 * answers, so it is cleared too.
 */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    clearDraft();
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await unsubscribePushAction(subscription.endpoint).catch(() => null);
        await subscription.unsubscribe().catch(() => false);
      }
    } catch {
      // No service worker or push here: nothing to drop.
    }
    await signOut();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <button
        type="submit"
        disabled={pending}
        className={buttonClass("secondary", "md") + " w-full"}
      >
        {pending ? "Излизам…" : "Изход"}
      </button>
    </form>
  );
}

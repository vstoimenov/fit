"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { clientEnv } from "@/env";
import { isInAppBrowser } from "@/lib/app/install-prompt";

const subscribeNever = () => () => {};
const clientInApp = () => isInAppBrowser(navigator.userAgent);
// Unknown during server render: nothing is shown until the browser is known.
const serverInApp = () => null;

/**
 * „Продължи с Google“, or, inside the Instagram/Facebook browser where Google refuses the sign-in,
 * a short note on how to open the page in Safari or Chrome instead.
 */
export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const inApp = useSyncExternalStore(subscribeNever, clientInApp, serverInApp);
  if (clientEnv.NEXT_PUBLIC_GOOGLE_AUTH !== "1" || inApp === null) return null;
  if (inApp) {
    return (
      <p className="rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
        Входът с Google не работи в браузъра на Instagram и Facebook. Продължи с имейл или отвори
        страницата в Safari или Chrome: менюто ⋯ горе вдясно → „Отвори в браузър“.
      </p>
    );
  }
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled} className="w-full">
      Продължи с Google
    </Button>
  );
}

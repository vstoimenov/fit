"use client";

import { Button } from "@/components/ui/button";

/**
 * The home-screen app has no reload button or pull-to-refresh: give one. The service worker shows
 * this page in place of the address she asked for, so a reload retries that address.
 */
export function RetryButton() {
  return (
    <Button size="md" onClick={() => window.location.reload()}>
      Опитай пак
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { openPortalAction } from "./actions";

export function ManageSubscriptionButton() {
  const [error, setError] = useState("");
  // Stays true after the redirect starts: the page is still visible while the browser navigates.
  const [redirecting, setRedirecting] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = pending || redirecting;

  function open() {
    setError("");
    startTransition(async () => {
      const result = await openPortalAction();
      if (!result.ok) return setError(result.message);
      setRedirecting(true);
      window.location.assign(result.data.url);
    });
  }

  return (
    <div className="space-y-2 pt-1">
      <Button variant="ghost" size="md" className="w-full" disabled={busy} onClick={open}>
        {busy ? "Пренасочване…" : "Управлявай абонамента"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-brick">
          {error}
        </p>
      )}
    </div>
  );
}

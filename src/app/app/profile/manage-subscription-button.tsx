"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { openPortalAction } from "./actions";

export function ManageSubscriptionButton() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function open() {
    setError("");
    startTransition(async () => {
      const result = await openPortalAction();
      if (!result.ok) return setError(result.message);
      window.location.assign(result.data.url);
    });
  }

  return (
    <div className="space-y-2 pt-1">
      <Button variant="ghost" size="md" className="w-full" disabled={pending} onClick={open}>
        {pending ? "Пренасочване…" : "Управлявай абонамента"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-brick">
          {error}
        </p>
      )}
    </div>
  );
}

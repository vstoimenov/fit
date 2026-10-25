"use client";

import { useState, useTransition } from "react";
import { joinChallengeAction } from "@/app/app/challenges/actions";
import { Button } from "@/components/ui/button";

/** „Включи се“: the primary action of a challenge she has not joined. The page refreshes with her days. */
export function JoinButton({ challengeId }: { challengeId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function join() {
    setError("");
    startTransition(async () => {
      try {
        const result = await joinChallengeAction(challengeId);
        if (!result.ok) setError(result.message);
      } catch {
        setError("Нещо се обърка. Опитай отново.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={join} disabled={pending} aria-busy={pending} className="w-full">
        Включи се
      </Button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brick">
          {error}
        </p>
      )}
    </div>
  );
}

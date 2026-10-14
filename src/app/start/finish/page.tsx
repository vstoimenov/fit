"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { completeOnboarding } from "@/app/start/actions";
import { clearDraft, loadDraft } from "@/components/onboarding/storage";
import { browserTimezone } from "@/lib/timezone";

/** After Google sign-in (or a returning user without onboarding): submit the saved answers. */
export default function FinishPage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const draft = loadDraft();
    if (!draft) return router.replace("/start");
    completeOnboarding({ ...draft, timezone: browserTimezone() })
      .then((result) => {
        if (!result.ok) {
          setError(result.message);
          setTimeout(() => router.replace("/start"), 2500);
          return;
        }
        clearDraft();
        router.replace(`/app/workout/${result.data.freeWorkoutId}?first=1`);
      })
      .catch(() => {
        // Network or server failure: say so and go back to the wizard, which keeps her answers.
        setError("Нещо се обърка. Опитай отново.");
        setTimeout(() => router.replace("/start"), 2500);
      });
  }, [router]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center">
      <p className="font-display text-2xl font-bold">{error || "Изграждаме твоя план…"}</p>
    </main>
  );
}

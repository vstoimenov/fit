"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearDraft } from "./storage";

/** For a user who already finished onboarding: drop any leftover health draft, then leave. */
export function DraftResetRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    clearDraft();
    router.replace(to);
  }, [router, to]);
  return <main className="min-h-dvh" aria-busy="true" />;
}

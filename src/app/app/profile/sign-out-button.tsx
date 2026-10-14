"use client";

import { clearDraft } from "@/components/onboarding/storage";
import { buttonClass } from "@/components/ui/button";
import { signOut } from "./actions";

/** The onboarding draft holds health answers: it must not outlive the session on a shared device. */
export function SignOutButton() {
  return (
    <form action={signOut} onSubmit={clearDraft}>
      <button type="submit" className={buttonClass("quiet", "md") + " w-full"}>
        Изход
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  async function onSubmit(form: FormData) {
    await createBrowserSupabaseClient().auth.resetPasswordForEmail(String(form.get("email")), {
      redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
    });
    // Same answer whether or not the email exists, so accounts cannot be enumerated.
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <h1 className="font-display text-3xl">Нова парола</h1>
      {sent ? (
        <p>Ако имаш профил с този имейл, ще получиш линк до минута.</p>
      ) : (
        <form action={onSubmit} className="space-y-4">
          <Field label="Имейл">
            <input name="email" type="email" required className={inputClass} />
          </Field>
          <Button type="submit" className="w-full">
            Изпрати линк
          </Button>
        </form>
      )}
    </main>
  );
}

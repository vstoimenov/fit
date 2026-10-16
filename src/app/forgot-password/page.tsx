"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, inputClass } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(form: FormData) {
    setError("");
    try {
      const { error: resetError } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(
        String(form.get("email")),
        {
          redirectTo: `${location.origin}/auth/callback?next=/reset-password`,
        },
      );
      // Supabase answers success for unknown emails too, so any returned error is infrastructure (rate limit, network).
      if (resetError) return setError("Нещо се обърка. Опитай отново.");
    } catch {
      return setError("Нещо се обърка. Опитай отново.");
    }
    // Same answer whether or not the email exists, so accounts cannot be enumerated.
    setSent(true);
  }

  return (
    <AuthCard title="Нова парола">
      {sent ? (
        <Card role="status" className="p-5">
          Ако имаш профил с този имейл, ще получиш линк до минута.
        </Card>
      ) : (
        <form action={onSubmit} className="space-y-4">
          <Field label="Имейл" error={error || undefined}>
            <input name="email" type="email" autoComplete="email" required className={inputClass} />
          </Field>
          <Button type="submit" className="w-full">
            Изпрати линк
          </Button>
        </form>
      )}
      <div className="flex justify-center">
        <Link href="/login" className={buttonClass("link")}>
          Към входа
        </Link>
      </div>
    </AuthCard>
  );
}

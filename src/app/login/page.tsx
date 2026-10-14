"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { clientEnv } from "@/env";
import { safeNext } from "@/lib/auth-redirect";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState(
    params.get("error") === "link" ? "Линкът е невалиден или изтекъл." : "",
  );
  const [busy, setBusy] = useState(false);

  async function onSubmit(form: FormData) {
    setBusy(true);
    setError("");
    const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (signInError) return setError("Грешен имейл или парола.");
    router.replace(next);
    router.refresh();
  }

  async function google() {
    await createBrowserSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 py-12">
      <h1 className="font-display text-4xl leading-none">Влез</h1>
      <form action={onSubmit} className="space-y-4">
        <Field label="Имейл">
          <input name="email" type="email" autoComplete="email" required className={inputClass} />
        </Field>
        <Field label="Парола" error={error || undefined}>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </Field>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Влизам…" : "Влез"}
        </Button>
      </form>
      {clientEnv.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
        <Button variant="ghost" onClick={google} className="w-full">
          Продължи с Google
        </Button>
      )}
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4">
          Забравена парола
        </Link>
        <Link href="/start" className="font-semibold underline underline-offset-4">
          Нямам профил
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

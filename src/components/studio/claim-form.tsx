"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { claimAction } from "@/app/zala/actions";
import { Button } from "@/components/ui/button";
import { Field, inputOnCardClass } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/** A walk-in sets her own e-mail and password; then she is signed in and sees her card. */
export function ClaimForm({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setBusy(true);
    setError(null);
    try {
      const res = await claimAction(token, { email, password });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({
        email: res.email,
        password,
      });
      if (signInError) {
        router.replace("/login?next=/zala");
        return;
      }
      router.replace("/zala");
      router.refresh();
    } catch {
      setError("Нещо се обърка. Опитай отново.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl bg-sand p-6">
      <Field label="Имейл">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputOnCardClass}
        />
      </Field>
      <Field label="Парола" hint="Поне 10 символа.">
        <input
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={inputOnCardClass}
        />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-brick">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Момент…" : "Създай профила"}
      </Button>
      <p className="text-center text-xs leading-relaxed text-ink-soft">
        Със създаването на профил приемаш{" "}
        <a
          href="/terms"
          target="_blank"
          className="font-semibold text-ink underline underline-offset-2"
        >
          Общите условия
        </a>{" "}
        и{" "}
        <a
          href="/privacy"
          target="_blank"
          className="font-semibold text-ink underline underline-offset-2"
        >
          Политиката за поверителност
        </a>
        .
      </p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, inputOnCardClass } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/** The short sign-up for the gym: no questions, no app install. `onJoined` books what she picked. */
export function JoinForm({
  title,
  existingAccount = false,
  join,
  onJoined,
}: {
  title: string;
  /** Already signed in (e.g. with Google) but without a phone: ask only for name and phone. */
  existingAccount?: boolean;
  join: (input: {
    name: string;
    phone: string;
  }) => Promise<{ ok: true } | { ok: false; message: string }>;
  onJoined: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(existingAccount);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    setBusy(true);
    setError(null);
    try {
      // A retry after the account exists must only save the contact, never sign up again.
      if (!created) {
        const { error: signUpError } = await createBrowserSupabaseClient().auth.signUp({
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
          options: { data: { name } },
        });
        if (signUpError) {
          setError(
            /registered|exists/i.test(signUpError.message)
              ? "Вече има профил с този имейл. Влез от „Имам профил“."
              : signUpError.message.includes("Password")
                ? "Паролата трябва да е поне 10 символа."
                : "Не успяхме да създадем профила.",
          );
          return;
        }
        setCreated(true);
      }
      const joined = await join({ name, phone });
      if (!joined.ok) {
        setError(joined.message);
        return;
      }
      await onJoined();
    } catch {
      setError("Нещо се обърка. Опитай отново.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl bg-sand p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <Field label="Име">
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          autoComplete="name"
          className={inputOnCardClass}
        />
      </Field>
      <Field label="Телефон" hint="Аксения ще ти пише, ако има промяна.">
        <input name="phone" type="tel" required autoComplete="tel" className={inputOnCardClass} />
      </Field>
      {!created && (
        <>
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
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-brick">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Момент…" : "Запиши ме"}
      </Button>
      {!existingAccount && (
        <>
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
          <div className="flex justify-center">
            <Link href="/login?next=/zala" className={buttonClass("link")}>
              Имам профил
            </Link>
          </div>
        </>
      )}
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Mode =
  | { kind: "loading" }
  | { kind: "verify"; factorId: string }
  | { kind: "enroll"; factorId: string; qr: string; secret: string };

/** Enrols an authenticator app on first visit, then asks for the 6-digit code on every new session. */
export function MfaForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Strict Mode mounts the effect twice in dev; the first run must not enrol or delete factors
    // concurrently with the second, so it bails out right after its first await.
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();
    (async () => {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) return setError("Не успяхме да заредим факторите. Опитай пак.");
      const verified = data.totp.find((f) => f.status === "verified");
      if (verified) return setMode({ kind: "verify", factorId: verified.id });
      for (const stale of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (enrollError || !enrolled)
        return setError("Не успяхме да започнем настройката. Опитай пак.");
      setMode({
        kind: "enroll",
        factorId: enrolled.id,
        qr: enrolled.totp.qr_code,
        secret: enrolled.totp.secret,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(form: FormData) {
    if (mode.kind === "loading" || busy) return;
    setBusy(true);
    setError("");
    const code = String(form.get("code") ?? "").replace(/\s/g, "");
    const { error: verifyError } = await createBrowserSupabaseClient().auth.mfa.challengeAndVerify({
      factorId: mode.factorId,
      code,
    });
    if (verifyError) {
      setBusy(false);
      return setError("Грешен или изтекъл код. Опитай пак.");
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
      <h1 className="font-display text-2xl font-bold">Двуфакторна защита</h1>
      {mode.kind === "loading" && !error && <p>Зареждане…</p>}
      {mode.kind === "enroll" && (
        <section className="space-y-3">
          <p>Сканирай кода с Google Authenticator, 1Password или подобно приложение:</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URI from Supabase */}
          <img
            src={mode.qr}
            alt="QR код за приложението за автентикация"
            className="h-48 w-48 rounded-xl bg-white p-2"
          />
          <p className="break-all text-sm text-ink-soft">Или въведи ключа ръчно: {mode.secret}</p>
        </section>
      )}
      {mode.kind !== "loading" && (
        <form action={onSubmit} className="space-y-4">
          <Field label="6-цифрен код" error={error || undefined}>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              required
              className={inputClass}
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Проверка…" : "Потвърди"}
          </Button>
        </form>
      )}
      {mode.kind === "loading" && error && (
        <p role="alert" className="text-brick">
          {error}
        </p>
      )}
    </main>
  );
}

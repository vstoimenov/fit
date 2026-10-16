"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/ui/auth-card";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(form: FormData) {
    const password = String(form.get("password"));
    if (password.length < 10) return setError("Поне 10 символа.");
    const { error: updateError } = await createBrowserSupabaseClient().auth.updateUser({
      password,
    });
    if (updateError) return setError("Линкът е изтекъл. Поискай нов.");
    router.replace("/app");
  }

  return (
    <AuthCard title="Избери нова парола">
      <form action={onSubmit} className="space-y-4">
        <Field label="Нова парола" hint="Поне 10 символа" error={error || undefined}>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
          />
        </Field>
        <Button type="submit" className="w-full">
          Запази
        </Button>
      </form>
    </AuthCard>
  );
}

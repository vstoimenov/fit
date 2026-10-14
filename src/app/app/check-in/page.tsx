"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { saveCheckIn } from "./actions";

function Scale({ name, label, faces }: { name: string; label: string; faces: string[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-5 gap-2">
        {faces.map((face, i) => (
          <label key={face} className="cursor-pointer">
            <input type="radio" name={name} value={i + 1} className="peer sr-only" />
            <span
              className={cn(
                "flex h-14 items-center justify-center rounded-2xl border-2 border-line bg-white text-2xl transition-all",
                "peer-checked:scale-105 peer-checked:border-ink peer-checked:bg-ink/5",
              )}
            >
              {face}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function CheckInPage() {
  const [state, action, pending] = useActionState(saveCheckIn, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <main className="space-y-6 px-5 pt-8">
      <h1 className="font-display text-3xl font-bold">Как си днес?</h1>
      <form action={action} className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Тегло, кг" error={errors.weight_kg}>
            <input name="weight_kg" inputMode="decimal" className={inputClass} />
          </Field>
          <Field label="Талия, см" error={errors.waist_cm}>
            <input name="waist_cm" inputMode="decimal" className={inputClass} />
          </Field>
          <Field label="Ханш, см" error={errors.hips_cm}>
            <input name="hips_cm" inputMode="decimal" className={inputClass} />
          </Field>
        </div>
        <Scale name="energy" label="Енергия" faces={["🪫", "😮‍💨", "🙂", "💪", "⚡️"]} />
        <Scale name="mood" label="Настроение" faces={["😞", "😕", "😐", "😊", "🤩"]} />
        <Field label="Бележка (по желание)">
          <textarea name="note" maxLength={500} rows={3} className={inputClass + " h-auto py-3"} />
        </Field>
        {state && !state.ok && (
          <p role="alert" className="text-brick">
            {state.message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Запазвам…" : "Запази"}
        </Button>
      </form>
    </main>
  );
}

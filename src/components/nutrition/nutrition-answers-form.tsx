"use client";

import { useRef, useState } from "react";
import { saveNutritionAnswersAction } from "@/app/app/nutrition/actions";
import { Button } from "@/components/ui/button";
import { nutritionFormToAnswers } from "@/lib/nutrition/answers-form";
import { nutritionAnswersSchema, type NutritionAnswers } from "@/lib/nutrition/schema";
import { sofiaToday } from "@/lib/progress-photos/today";
import { NutritionFields, type NutritionValues } from "./nutrition-fields";

const EMPTY: NutritionValues = { allergens: [], avoidFoods: "", mealsPerDay: 3 };

/**
 * Her nutrition answers as a form: the Профил card and the first visit to the diary. Controlled, and
 * submitted from the DOM through onSubmit (not `<form action>`, which would reset the fields after a
 * failed save). `initial` is null until she has answered.
 */
export function NutritionAnswersForm({
  initial,
  onSaved,
  variant = "primary",
  submitLabel = "Запази",
}: {
  initial: NutritionAnswers | null;
  onSaved?: () => void;
  /** Secondary where the page already has its one primary button (Профил). */
  variant?: "primary" | "secondary";
  submitLabel?: string;
}) {
  const [values, setValues] = useState<NutritionValues>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // correct in the same tick, unlike state: double taps

  function change(patch: Partial<NutritionValues>) {
    setValues((prev) => ({ ...prev, ...patch }));
    setErrors({});
    setMessage(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const data = new FormData(event.currentTarget);
    // The server checks again; this only puts the message next to the field without a round trip.
    const checked = nutritionAnswersSchema(Number(sofiaToday().slice(0, 4))).safeParse(
      nutritionFormToAnswers(data),
    );
    if (!checked.success) {
      const found: Record<string, string> = {};
      for (const issue of checked.error.issues) found[issue.path.join(".")] ??= issue.message;
      setErrors(found);
      setMessage(null);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await saveNutritionAnswersAction(data);
      if (result.ok) {
        setErrors({});
        setMessage({ ok: true, text: "Запазено ✓" });
        onSaved?.();
      } else {
        setErrors(result.fieldErrors ?? {});
        setMessage({ ok: false, text: result.message });
      }
    } catch {
      setMessage({ ok: false, text: "Нещо се обърка. Опитай отново." });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <NutritionFields value={values} onChange={change} errors={errors} />
      {message &&
        (message.ok ? (
          <p role="status" className="text-moss">
            {message.text}
          </p>
        ) : (
          // A field-level error already says it next to the field.
          Object.keys(errors).length === 0 && (
            <p role="alert" className="text-brick">
              {message.text}
            </p>
          )
        ))}
      <Button type="submit" variant={variant} size="md" disabled={busy} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}

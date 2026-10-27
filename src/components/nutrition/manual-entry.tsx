"use client";

import { useRef, useState } from "react";
import { addManualEntry } from "@/app/app/nutrition/actions";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { manualEntrySchema } from "@/lib/nutrition/schema";
import type { DiarySlot } from "@/lib/nutrition/labels";

type Fields = { name: string; kcal: string; proteinG: string; carbsG: string; fatG: string };
const EMPTY: Fields = { name: "", kcal: "", proteinG: "", carbsG: "", fatG: "" };

/** Empty stays absent (the action counts it as 0); anything else must be a number. */
function optionalNumber(raw: string): number | undefined {
  const text = raw.trim().replace(",", ".");
  return text === "" ? undefined : Number(text);
}

/**
 * Hand-typed food: name + kcal, macros optional. Also the fallback when the AI is off or fails. The
 * batch id lives as long as the form is open, so a retried or double-tapped save cannot add it twice.
 */
export function ManualEntry({
  day,
  meal,
  onDone,
}: {
  day: string;
  meal: DiarySlot;
  /** Called after a successful save and on „Затвори“. */
  onDone: () => void;
}) {
  const [values, setValues] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // correct in the same tick, unlike state: double taps
  const batchId = useRef<string | null>(null);

  function set(key: keyof Fields, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors({});
    setMessage(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    const input = {
      name: values.name,
      kcal: values.kcal.trim() === "" ? Number.NaN : Number(values.kcal.trim().replace(",", ".")),
      proteinG: optionalNumber(values.proteinG),
      carbsG: optionalNumber(values.carbsG),
      fatG: optionalNumber(values.fatG),
    };
    // The server checks again; this only puts the message next to the field without a round trip.
    const checked = manualEntrySchema.safeParse(input);
    if (!checked.success) {
      const found: Record<string, string> = {};
      for (const issue of checked.error.issues) {
        found[issue.path.join(".")] ??=
          Number.isNaN(input.kcal) && issue.path[0] === "kcal" ? "Въведи калориите" : issue.message;
      }
      setErrors(found);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    batchId.current ??= crypto.randomUUID();
    try {
      const result = await addManualEntry({ day, meal, batchId: batchId.current, ...checked.data });
      if (result.ok) {
        onDone();
        return;
      }
      setErrors(result.fieldErrors ?? {});
      setMessage(result.message);
    } catch {
      setMessage("Нещо се обърка. Опитай отново.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 border-t border-line pt-4">
      <Field label="Какво яде?" error={errors.name}>
        <input
          value={values.name}
          onChange={(event) => set("name", event.target.value)}
          maxLength={120}
          autoComplete="off"
          autoFocus
          aria-invalid={Boolean(errors.name)}
          className={inputClass}
        />
      </Field>
      <Field label="Калории (ккал)" error={errors.kcal}>
        <input
          value={values.kcal}
          onChange={(event) => set("kcal", event.target.value)}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={Boolean(errors.kcal)}
          className={inputClass}
        />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Макроси, г (по желание)</legend>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["proteinG", "Белтъчини"],
              ["carbsG", "Въглехидрати"],
              ["fatG", "Мазнини"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block space-y-1">
              <span className="block text-xs text-ink-soft">{label}</span>
              <input
                value={values[key]}
                onChange={(event) => set(key, event.target.value)}
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={Boolean(errors[key])}
                className={inputClass}
              />
              {errors[key] && <span className="block text-xs text-brick">{errors[key]}</span>}
            </label>
          ))}
        </div>
      </fieldset>
      {message && Object.keys(errors).length === 0 && (
        <p role="alert" className="text-sm text-brick">
          {message}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" size="md" disabled={busy} className="flex-1">
          Запиши
        </Button>
        <Button variant="secondary" size="md" onClick={onDone} disabled={busy}>
          Затвори
        </Button>
      </div>
    </form>
  );
}

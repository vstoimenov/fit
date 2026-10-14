"use client";

import { useActionState, useState } from "react";
import { clearDraft } from "@/components/onboarding/storage";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { LEVEL_LABEL } from "@/lib/labels";
import type { Level } from "@/lib/program/types";
import { deleteMyAccount, saveProfile } from "./actions";

export function ProfileForms({ name, level }: { name: string; level: Level }) {
  const [saveState, save, saving] = useActionState(saveProfile, null);
  const [deleteState, remove, removing] = useActionState(deleteMyAccount, null);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <form action={save} className="space-y-4 rounded-[1.75rem] bg-white p-5 ring-1 ring-line">
        <h2 className="font-semibold">Данни</h2>
        <Field label="Име">
          <input key={name} name="name" defaultValue={name} className={inputClass} />
        </Field>
        <Field label="Ниво" hint="Можеш да го сменяш по всяко време.">
          <select key={level} name="level" defaultValue={level} className={inputClass}>
            {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </Field>
        {saveState &&
          (saveState.ok ? (
            <p className="text-moss">Запазено ✓</p>
          ) : (
            <p className="text-brick">{saveState.message}</p>
          ))}
        <Button type="submit" size="md" disabled={saving} className="w-full">
          Запази
        </Button>
      </form>

      <section className="space-y-3">
        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="text-sm text-brick underline underline-offset-4"
          >
            Изтрий профила ми
          </button>
        ) : (
          <form
            action={remove}
            onSubmit={clearDraft}
            className="space-y-3 rounded-[1.75rem] border-2 border-brick p-5"
          >
            <p className="text-sm">
              Това изтрива профила, тренировките и прогреса ти завинаги. Напиши{" "}
              <strong>ИЗТРИЙ</strong>:
            </p>
            <input name="confirm" className={inputClass} autoComplete="off" />
            {deleteState && !deleteState.ok && (
              <p className="text-sm text-brick">{deleteState.message}</p>
            )}
            <Button
              type="submit"
              size="md"
              disabled={removing}
              className="w-full bg-brick shadow-none"
            >
              Изтрий завинаги
            </Button>
          </form>
        )}
      </section>
    </>
  );
}

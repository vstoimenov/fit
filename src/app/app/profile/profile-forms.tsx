"use client";

import { useActionState, useState, useTransition } from "react";
import { clearDraft } from "@/components/onboarding/storage";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Consent } from "@/components/ui/consent";
import { Field, inputClass, inputOnCardClass } from "@/components/ui/field";
import { GOAL_LABEL, GOALS, LEVEL_LABEL, PROBLEM_LABEL, PROBLEMS } from "@/lib/labels";
import type { Goal, Problem } from "@/lib/labels";
import type { Level } from "@/lib/program/types";
import { deleteMyAccount, saveAnswers, saveProfile } from "./actions";

export interface SavedAnswers {
  goal: Goal | "";
  problems: Problem[];
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  phone: string;
  phoneCallConsent: boolean;
  marketingConsent: boolean;
}

/** "Лични данни": the name/level form and the saved onboarding answers, in one card. */
export function PersonalData({
  name,
  level,
  answers,
}: {
  name: string;
  level: Level;
  answers: SavedAnswers;
}) {
  const [saveState, save, saving] = useActionState(saveProfile, null);
  // Held here, not in AnswersForm: the form below remounts on a successful save and must not lose the result.
  const [answersState, saveAnswersAction, savingAnswers] = useActionState(saveAnswers, null);

  return (
    <Card className="space-y-5 p-5">
      <h2 className="font-semibold">Лични данни</h2>
      <form action={save} className="space-y-4">
        <Field label="Име">
          <input key={name} name="name" defaultValue={name} className={inputOnCardClass} />
        </Field>
        <Field label="Ниво" hint="Можеш да го сменяш по всяко време.">
          <select key={level} name="level" defaultValue={level} className={inputOnCardClass}>
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
        <Button type="submit" variant="secondary" size="md" disabled={saving} className="w-full">
          Запази
        </Button>
      </form>

      {/* Keyed by the saved values: a successful save remounts it with the new state. */}
      <AnswersForm
        key={JSON.stringify(answers)}
        answers={answers}
        state={answersState}
        save={saveAnswersAction}
        saving={savingAnswers}
      />
    </Card>
  );
}

/** Deleting the account: a text link first, then the typed confirmation word. */
export function DeleteAccount() {
  const [deleteState, remove, removing] = useActionState(deleteMyAccount, null);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">
        Съгласието за обработка на здравни данни (тегло, мерки, здравословни проблеми) е необходимо,
        за да работи профилът. Ако го оттеглиш, профилът ти се изтрива.
      </p>
      {!showDelete ? (
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="min-h-11 rounded-md text-sm font-semibold text-brick underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Изтрий профила ми
        </button>
      ) : (
        <form
          action={remove}
          onSubmit={clearDraft}
          className="space-y-3 rounded-2xl border-[1.5px] border-brick bg-white p-4"
        >
          <p className="text-sm">
            Това изтрива профила, тренировките и прогреса ти завинаги. Напиши{" "}
            <strong>ИЗТРИЙ</strong>:
          </p>
          <input
            name="confirm"
            aria-label="Напиши ИЗТРИЙ за потвърждение"
            className={inputClass}
            autoComplete="off"
          />
          {deleteState && !deleteState.ok && (
            <p className="text-sm text-brick">{deleteState.message}</p>
          )}
          <Button type="submit" size="md" disabled={removing} className="w-full bg-brick">
            Изтрий завинаги
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * Controlled and submitted through onSubmit + a transition instead of `<form action>`: React 19 resets
 * the form's DOM fields after every action, which would revert the checkboxes (and any typed value)
 * on a failed save while the state still holds them.
 */
function AnswersForm({
  answers,
  state,
  save,
  saving,
}: {
  answers: SavedAnswers;
  state: ActionResult<null> | null;
  save: (form: FormData) => void;
  saving: boolean;
}) {
  const [goal, setGoal] = useState(answers.goal);
  const [problems, setProblems] = useState(answers.problems);
  const [height, setHeight] = useState(String(answers.heightCm ?? ""));
  const [weight, setWeight] = useState(String(answers.weightKg ?? ""));
  const [target, setTarget] = useState(String(answers.targetWeightKg ?? ""));
  const [phone, setPhone] = useState(answers.phone);
  const [callConsent, setCallConsent] = useState(answers.phoneCallConsent);
  const [marketing, setMarketing] = useState(answers.marketingConsent);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const [, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => save(data));
      }}
      noValidate
      className="space-y-4 border-t border-line pt-5"
    >
      <h3 className="font-semibold">Моите отговори</h3>
      <Field label="Цел" error={errors.goal}>
        <select
          name="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value as Goal | "")}
          className={inputOnCardClass}
        >
          <option value="" disabled>
            Избери
          </option>
          {GOALS.map((g) => (
            <option key={g} value={g}>
              {GOAL_LABEL[g]}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="space-y-0">
        <legend className="text-sm font-semibold">Какво те притеснява</legend>
        {PROBLEMS.map((p) => (
          <Consent
            key={p}
            checked={problems.includes(p)}
            onChange={(on) =>
              setProblems((prev) => (on ? [...prev, p] : prev.filter((x) => x !== p)))
            }
          >
            {PROBLEM_LABEL[p]}
          </Consent>
        ))}
        {problems.map((p) => (
          <input key={p} type="hidden" name="problems" value={p} />
        ))}
      </fieldset>
      <Field label="Ръст (см)" error={errors.heightCm}>
        <input
          name="heightCm"
          type="number"
          inputMode="numeric"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          className={inputOnCardClass}
        />
      </Field>
      <Field label="Тегло (кг)" error={errors.weightKg}>
        <input
          name="weightKg"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className={inputOnCardClass}
        />
      </Field>
      <Field label="Целево тегло (кг)" error={errors.targetWeightKg}>
        <input
          name="targetWeightKg"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={inputOnCardClass}
        />
      </Field>
      <Field
        label="Телефон"
        error={errors.phone}
        hint="Празно поле изтрива номера. Без телефон не можем да ти звъним."
      >
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputOnCardClass}
        />
      </Field>
      <div>
        <Consent name="phoneCallConsent" checked={callConsent} onChange={setCallConsent}>
          Съгласна съм треньорът да ми се обади.
        </Consent>
        <Consent name="marketingConsent" checked={marketing} onChange={setMarketing}>
          Искам да получавам съвети и оферти по имейл.
        </Consent>
      </div>
      {state &&
        (state.ok ? (
          <p className="text-moss">Запазено ✓</p>
        ) : (
          // A field-level error already says it next to the field.
          Object.keys(errors).length === 0 && (
            <p role="alert" className="text-brick">
              {state.message}
            </p>
          )
        ))}
      <Button type="submit" variant="secondary" size="md" disabled={saving} className="w-full">
        Запази отговорите
      </Button>
    </form>
  );
}

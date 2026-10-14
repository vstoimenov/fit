"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { completeOnboarding } from "@/app/start/actions";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { clientEnv } from "@/env";
import {
  EXPERIENCE,
  EXPERIENCE_LABEL,
  GOAL_LABEL,
  GOALS,
  PROBLEM_LABEL,
  PROBLEMS,
  TIME_LABEL,
  TIMES,
} from "@/lib/labels";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { ChoiceList, NumberSlider } from "./steps";
import { clearDraft, loadDraftRaw, parseDraft, saveDraft, type Draft } from "./storage";

const DEFAULTS: Draft = {
  problems: [],
  heightCm: 165,
  weightKg: 68,
  targetWeightKg: 62,
  phone: "",
  phoneCallConsent: false,
  healthConsent: undefined,
  marketingConsent: false,
  name: "",
};

const subscribeNever = () => () => {};
const serverDraft = () => null;

type StepId = "goal" | "problems" | "experience" | "body" | "time" | "contact" | "account";

export function Wizard({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const steps: StepId[] = [
    "goal",
    "problems",
    "experience",
    "body",
    "time",
    "contact",
    ...(signedIn ? [] : ["account" as const]),
  ];
  const [index, setIndex] = useState(0);
  // Saved answers are read on the client only (null during SSR/hydration), then edits are kept in state.
  const savedRaw = useSyncExternalStore(subscribeNever, loadDraftRaw, serverDraft);
  const saved = useMemo(() => ({ ...DEFAULTS, ...parseDraft(savedRaw) }), [savedRaw]);
  const [edited, setDraft] = useState<Draft | null>(null);
  const draft = edited ?? saved;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const step = steps[index]!;
  const set = (patch: Draft) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveDraft(next);
  };

  const canContinue: Record<StepId, boolean> = {
    goal: Boolean(draft.goal),
    problems: true,
    experience: Boolean(draft.experience),
    body: true,
    time: Boolean(draft.time),
    contact:
      Boolean(draft.name?.trim()) &&
      draft.healthConsent === true &&
      (!draft.phoneCallConsent || Boolean(draft.phone)),
    account: true,
  };

  async function finish() {
    setBusy(true);
    setError("");
    const result = await completeOnboarding(draft);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    clearDraft();
    router.replace(`/app/workout/${result.data.freeWorkoutId}?first=1`);
  }

  async function signUp(form: FormData) {
    setBusy(true);
    setError("");
    const { error: signUpError } = await createBrowserSupabaseClient().auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: { data: { name: draft.name } },
    });
    if (signUpError) {
      setBusy(false);
      return setError(
        /registered|exists/i.test(signUpError.message)
          ? "Вече има профил с този имейл. Влез от „Имам профил“."
          : signUpError.message.includes("Password")
            ? "Паролата трябва да е поне 10 символа."
            : "Не успяхме да създадем профила.",
      );
    }
    await finish();
  }

  async function google() {
    saveDraft(draft);
    await createBrowserSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/start/finish` },
    });
  }

  const next = () =>
    step === "contact" && signedIn ? finish() : setIndex((i) => Math.min(i + 1, steps.length - 1));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col overflow-x-clip px-6 pb-8 pt-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          className="h-10 w-10 rounded-full bg-ink/5 text-xl disabled:opacity-0"
          disabled={index === 0}
          aria-label="Назад"
        >
          ←
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full bg-ember"
            animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.22 }}
          className="flex flex-1 flex-col gap-6 pt-10"
        >
          {step === "goal" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">
                Какво искаш да постигнеш?
              </h1>
              <ChoiceList
                options={GOALS}
                labels={GOAL_LABEL}
                value={draft.goal}
                onChange={(v) => set({ goal: v as Draft["goal"] })}
              />
            </>
          )}
          {step === "problems" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">
                Какво те притеснява най-много?
              </h1>
              <p className="-mt-3 text-ink-soft">Избери всичко, което важи.</p>
              <ChoiceList
                multiple
                options={PROBLEMS}
                labels={PROBLEM_LABEL}
                value={draft.problems}
                onChange={(v) => set({ problems: v as Draft["problems"] })}
              />
            </>
          )}
          {step === "experience" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">
                Колко тренираш досега?
              </h1>
              <ChoiceList
                options={EXPERIENCE}
                labels={EXPERIENCE_LABEL}
                value={draft.experience}
                onChange={(v) => set({ experience: v as Draft["experience"] })}
              />
            </>
          )}
          {step === "body" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">Отправна точка</h1>
              <p className="-mt-3 text-ink-soft">Само ти и треньорът ти виждате тези числа.</p>
              <NumberSlider
                label="Ръст"
                unit="см"
                min={140}
                max={200}
                value={draft.heightCm ?? 165}
                onChange={(v) => set({ heightCm: v })}
              />
              <NumberSlider
                label="Тегло"
                unit="кг"
                min={40}
                max={150}
                step={0.5}
                value={draft.weightKg ?? 68}
                onChange={(v) => set({ weightKg: v })}
              />
              <NumberSlider
                label="Цел"
                unit="кг"
                min={40}
                max={150}
                step={0.5}
                value={draft.targetWeightKg ?? 62}
                onChange={(v) => set({ targetWeightKg: v })}
              />
            </>
          )}
          {step === "time" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">
                Колко време имаш за тренировка?
              </h1>
              <ChoiceList
                options={TIMES}
                labels={TIME_LABEL}
                value={draft.time}
                onChange={(v) => set({ time: v as Draft["time"] })}
              />
            </>
          )}
          {step === "contact" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">Почти готово</h1>
              <Field label="Как да те наричаме?">
                <input
                  className={inputClass}
                  value={draft.name ?? ""}
                  onChange={(e) => set({ name: e.target.value })}
                  autoComplete="given-name"
                />
              </Field>
              <Field
                label="Телефон (по желание)"
                hint="Ако нещо не върви, треньорът може да ти звънне."
              >
                <input
                  className={inputClass}
                  type="tel"
                  value={draft.phone ?? ""}
                  onChange={(e) => set({ phone: e.target.value })}
                  autoComplete="tel"
                />
              </Field>
              <Consent
                checked={draft.phoneCallConsent === true}
                onChange={(v) => set({ phoneCallConsent: v })}
              >
                Съгласна съм треньорът да ми се обади.
              </Consent>
              <Consent
                checked={draft.healthConsent === true}
                onChange={(v) => set({ healthConsent: v ? true : undefined })}
              >
                <strong>Задължително:</strong> съгласна съм да се обработват данните ми за тегло,
                мерки и здравословни проблеми, за да получа персонален план.
              </Consent>
              <Consent
                checked={draft.marketingConsent === true}
                onChange={(v) => set({ marketingConsent: v })}
              >
                Искам да получавам съвети и оферти по имейл.
              </Consent>
            </>
          )}
          {step === "account" && (
            <>
              <h1 className="font-display text-3xl font-bold leading-tight">
                Създай профила си и започни
              </h1>
              <form action={signUp} className="space-y-4">
                <Field label="Имейл">
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </Field>
                <Field label="Парола" hint="Поне 10 символа">
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </Field>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? "Подготвяме плана ти…" : "Към първата тренировка"}
                </Button>
              </form>
              {clientEnv.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
                <Button variant="ghost" onClick={google} className="w-full">
                  Продължи с Google
                </Button>
              )}
              <Link href="/login" className="text-center text-sm underline underline-offset-4">
                Имам профил
              </Link>
            </>
          )}
          {error && (
            <p role="alert" className="rounded-2xl bg-brick/10 p-4 text-brick">
              {error}
            </p>
          )}
        </motion.section>
      </AnimatePresence>

      {step !== "account" && (
        <Button onClick={next} disabled={!canContinue[step] || busy} className="mt-6 w-full">
          {step === "contact" && signedIn
            ? busy
              ? "Подготвяме плана ти…"
              : "Към първата тренировка"
            : "Напред"}
        </Button>
      )}
    </main>
  );
}

function Consent({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex gap-3 text-sm leading-snug">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ember)]"
      />
      <span>{children}</span>
    </label>
  );
}

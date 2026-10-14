"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { completeOnboarding } from "@/app/start/actions";
import { Button } from "@/components/ui/button";
import { Consent } from "@/components/ui/consent";
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
import { onboardingSchema } from "@/lib/onboarding/schema";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { browserTimezone } from "@/lib/timezone";
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

const STEP_OF_FIELD: Record<string, StepId> = {
  goal: "goal",
  problems: "problems",
  experience: "experience",
  heightCm: "body",
  weightKg: "body",
  targetWeightKg: "body",
  time: "time",
  name: "contact",
  phone: "contact",
  phoneCallConsent: "contact",
  healthConsent: "contact",
  marketingConsent: "contact",
};

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // Refs, not state: they must be correct in the same tick (double taps) and survive retries.
  const busyRef = useRef(false);
  const accountCreated = useRef(false);

  const step = steps[index]!;
  const set = (patch: Draft) => {
    setDraft((prev) => ({ ...(prev ?? saved), ...patch }));
    setFieldErrors({});
  };
  useEffect(() => {
    if (edited) saveDraft(edited);
  }, [edited]);

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

  function lock(): boolean {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    return true;
  }
  function unlock() {
    busyRef.current = false;
    setBusy(false);
  }

  /** Validates every answer; on failure shows the message on the step it belongs to. */
  function validate(): boolean {
    const result = onboardingSchema.safeParse(draft);
    if (result.success) {
      setFieldErrors({});
      return true;
    }
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) errors[issue.path.join(".")] ??= issue.message;
    setFieldErrors(errors);
    const failedStep = STEP_OF_FIELD[String(result.error.issues[0]?.path[0])] ?? "contact";
    setIndex(Math.max(steps.indexOf(failedStep), 0));
    return false;
  }

  /** Caller holds the lock. The lock stays on after success: the page is navigating away. */
  async function submitAnswers() {
    try {
      const result = await completeOnboarding({ ...draft, timezone: browserTimezone() });
      if (!result.ok) {
        unlock();
        setError(result.message);
        return;
      }
      clearDraft();
      router.replace(`/app/workout/${result.data.freeWorkoutId}?first=1`);
    } catch {
      unlock();
      setError("Нещо се обърка. Опитай отново.");
    }
  }

  async function finish() {
    if (!validate() || !lock()) return;
    await submitAnswers();
  }

  async function signUp(form: FormData) {
    if (busyRef.current || !validate() || !lock()) return;
    // A retry after the account exists must only save the answers, never sign up again.
    if (!accountCreated.current) {
      try {
        const { error: signUpError } = await createBrowserSupabaseClient().auth.signUp({
          email: String(form.get("email")),
          password: String(form.get("password")),
          options: { data: { name: draft.name } },
        });
        if (signUpError) {
          unlock();
          setError(
            /registered|exists/i.test(signUpError.message)
              ? "Вече има профил с този имейл. Влез от „Имам профил“."
              : signUpError.message.includes("Password")
                ? "Паролата трябва да е поне 10 символа."
                : "Не успяхме да създадем профила.",
          );
          return;
        }
      } catch {
        // Network failure or a thrown client error: release the lock so she can retry.
        unlock();
        setError("Нещо се обърка. Опитай отново.");
        return;
      }
      accountCreated.current = true;
    }
    await submitAnswers();
  }

  async function google() {
    saveDraft(draft);
    await createBrowserSupabaseClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/start/finish` },
    });
  }

  function next() {
    if (step === "contact") {
      if (signedIn) return void finish();
      if (!validate()) return;
    }
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  }

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
                min={120}
                max={230}
                value={draft.heightCm ?? 165}
                onChange={(v) => set({ heightCm: v })}
              />
              <NumberSlider
                label="Тегло"
                unit="кг"
                min={30}
                max={250}
                step={0.5}
                value={draft.weightKg ?? 68}
                onChange={(v) => set({ weightKg: v })}
              />
              <NumberSlider
                label="Цел"
                unit="кг"
                min={30}
                max={250}
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
              <Field label="Как да те наричаме?" error={fieldErrors.name}>
                <input
                  className={inputClass}
                  value={draft.name ?? ""}
                  onChange={(e) => set({ name: e.target.value })}
                  autoComplete="given-name"
                />
              </Field>
              <Field
                label="Телефон (по желание)"
                error={fieldErrors.phone}
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
              {fieldErrors.healthConsent && (
                <p className="-mt-3 text-sm text-brick">{fieldErrors.healthConsent}</p>
              )}
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

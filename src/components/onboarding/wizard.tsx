"use client";

import { ChevronLeft } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { completeOnboarding } from "@/app/start/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { Consent } from "@/components/ui/consent";
import { Field, inputClass } from "@/components/ui/field";
import { clientEnv } from "@/env";
import { cn } from "@/lib/cn";
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
import { transitionFor } from "@/lib/motion";
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

const TITLE: Record<StepId, string> = {
  goal: "Какво искаш да постигнеш?",
  problems: "Какво те притеснява най-много?",
  experience: "Колко тренираш досега?",
  body: "Отправна точка",
  time: "Колко време имаш за тренировка?",
  contact: "Почти готово",
  account: "Създай профила си и започни",
};

const HINT: Partial<Record<StepId, string>> = {
  problems: "Избери всичко, което важи.",
  body: "Само ти и треньорът ти виждате тези числа.",
};

/** Inputs are sand; on the sand desktop card they turn white so they stay visible. */
const fieldClass = cn(inputClass, "lg:bg-white");
const TITLE_ID = "question-title";

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
  const [index, setIndexRaw] = useState(0);
  // The first screen paints at once (it is server-rendered); only later steps animate in.
  const [navigated, setNavigated] = useState(false);
  const setIndex: typeof setIndexRaw = (next) => {
    setNavigated(true);
    setIndexRaw(next);
  };
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
  const reduced = useReducedMotion() ?? false;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownIndex = useRef(index);
  // Moving to another question: start at the top and land on its heading (not on first load).
  useEffect(() => {
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);
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

  const submitLabel = busy
    ? "Подготвяме плана ти…"
    : step === "account" || (step === "contact" && signedIn)
      ? "Към първата тренировка"
      : "Напред";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (step === "account") return void signUp(new FormData(event.currentTarget));
    if (canContinue[step]) next();
  }

  return (
    <main className="min-h-dvh lg:flex lg:items-center lg:justify-center lg:px-6 lg:py-12">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-clip lg:min-h-0 lg:max-w-lg lg:rounded-2xl lg:bg-sand lg:p-10">
        <div className="flex items-center gap-3 px-6 pt-4 lg:px-0 lg:pt-0">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(i - 1, 0))}
            className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:invisible lg:-ml-2"
            disabled={index === 0 || busy}
            aria-label="Назад"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div
            role="progressbar"
            aria-label="Напредък"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={index + 1}
            className="h-2 flex-1 overflow-hidden rounded-full bg-sand lg:bg-white"
          >
            <motion.div
              className="h-full rounded-full bg-powder"
              initial={false}
              animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
              transition={transitionFor(reduced, "page")}
            />
          </div>
          <span className="w-9 text-right text-sm tabular-nums text-ink-soft">
            {index + 1}/{steps.length}
          </span>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <motion.section
            key={step}
            initial={navigated ? { opacity: 0, x: reduced ? 0 : 24 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={transitionFor(reduced, "page")}
            className="flex flex-1 flex-col gap-6 px-6 pb-6 pt-6 lg:px-0 lg:pb-0"
          >
            <div className="space-y-2">
              <h1
                ref={headingRef}
                id={TITLE_ID}
                tabIndex={-1}
                className="font-display text-[28px] leading-[1.1] tracking-[-0.02em] outline-none lg:text-[34px] lg:leading-[1.05]"
              >
                {TITLE[step]}
              </h1>
              {HINT[step] && <p className="text-ink-soft">{HINT[step]}</p>}
            </div>
            {step === "goal" && (
              <ChoiceList
                name="goal"
                labelledBy={TITLE_ID}
                options={GOALS}
                labels={GOAL_LABEL}
                value={draft.goal}
                onChange={(v) => set({ goal: v as Draft["goal"] })}
              />
            )}
            {step === "problems" && (
              <ChoiceList
                multiple
                name="problems"
                labelledBy={TITLE_ID}
                options={PROBLEMS}
                labels={PROBLEM_LABEL}
                value={draft.problems}
                onChange={(v) => set({ problems: v as Draft["problems"] })}
              />
            )}
            {step === "experience" && (
              <ChoiceList
                name="experience"
                labelledBy={TITLE_ID}
                options={EXPERIENCE}
                labels={EXPERIENCE_LABEL}
                value={draft.experience}
                onChange={(v) => set({ experience: v as Draft["experience"] })}
              />
            )}
            {step === "body" && (
              <div className="space-y-3">
                <NumberSlider
                  className="lg:bg-white"
                  label="Ръст"
                  unit="см"
                  min={120}
                  max={230}
                  value={draft.heightCm ?? 165}
                  onChange={(v) => set({ heightCm: v })}
                />
                <NumberSlider
                  className="lg:bg-white"
                  label="Тегло"
                  unit="кг"
                  min={30}
                  max={250}
                  step={0.5}
                  value={draft.weightKg ?? 68}
                  onChange={(v) => set({ weightKg: v })}
                />
                <NumberSlider
                  className="lg:bg-white"
                  label="Цел"
                  unit="кг"
                  min={30}
                  max={250}
                  step={0.5}
                  value={draft.targetWeightKg ?? 62}
                  onChange={(v) => set({ targetWeightKg: v })}
                />
              </div>
            )}
            {step === "time" && (
              <ChoiceList
                name="time"
                labelledBy={TITLE_ID}
                options={TIMES}
                labels={TIME_LABEL}
                value={draft.time}
                onChange={(v) => set({ time: v as Draft["time"] })}
              />
            )}
            {step === "contact" && (
              <div className="space-y-4">
                <Field label="Как да те наричаме?" error={fieldErrors.name}>
                  <input
                    className={fieldClass}
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
                    className={fieldClass}
                    type="tel"
                    value={draft.phone ?? ""}
                    onChange={(e) => set({ phone: e.target.value })}
                    autoComplete="tel"
                  />
                </Field>
                <div className="space-y-1">
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
                    <strong>Задължително:</strong> съгласна съм да се обработват данните ми за
                    тегло, мерки и здравословни проблеми, за да получа персонален план.
                  </Consent>
                  {fieldErrors.healthConsent && (
                    <p className="text-sm text-brick">{fieldErrors.healthConsent}</p>
                  )}
                  <Consent
                    checked={draft.marketingConsent === true}
                    onChange={(v) => set({ marketingConsent: v })}
                  >
                    Искам да получавам съвети и оферти по имейл.
                  </Consent>
                </div>
              </div>
            )}
            {step === "account" && (
              <div className="space-y-4">
                <Field label="Имейл">
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className={fieldClass}
                  />
                </Field>
                <Field label="Парола" hint="Поне 10 символа">
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={10}
                    autoComplete="new-password"
                    className={fieldClass}
                  />
                </Field>
                {clientEnv.NEXT_PUBLIC_GOOGLE_AUTH === "1" && (
                  <Button variant="secondary" onClick={google} className="w-full">
                    Продължи с Google
                  </Button>
                )}
                <div className="flex justify-center">
                  <Link href="/login" className={buttonClass("link")}>
                    Имам профил
                  </Link>
                </div>
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-2xl bg-brick/10 p-4 text-brick">
                {error}
              </p>
            )}
          </motion.section>

          <div className="sticky bottom-0 border-t border-line bg-white px-6 pt-3 pb-safe lg:static lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-8">
            <Button type="submit" disabled={!canContinue[step] || busy} className="w-full">
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}

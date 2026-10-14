import type { OnboardingAnswers } from "@/lib/onboarding/schema";

export const ANSWERS_KEY = "fp_onboarding_v1";
export type Draft = Partial<OnboardingAnswers>;

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(ANSWERS_KEY, JSON.stringify(draft));
  } catch {
    // Private mode / storage blocked: the email path still works without the draft.
  }
}

/** The stored draft as a raw string: a stable snapshot for useSyncExternalStore. */
export function loadDraftRaw(): string | null {
  try {
    return localStorage.getItem(ANSWERS_KEY);
  } catch {
    return null;
  }
}

export function parseDraft(raw: string | null): Draft | null {
  try {
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function loadDraft(): Draft | null {
  return parseDraft(loadDraftRaw());
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(ANSWERS_KEY);
  } catch {
    // ignore
  }
}

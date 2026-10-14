import type { OnboardingAnswers } from "@/lib/onboarding/schema";

export const ANSWERS_KEY = "fp_onboarding_v1";
/** The draft holds health answers: it is not kept longer than a day. */
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type Draft = Partial<OnboardingAnswers> & { savedAt?: number };

/** A draft without a timestamp (or from the future) counts as expired. */
export function isDraftFresh(draft: Draft | null, now: number = Date.now()): boolean {
  if (!draft || typeof draft.savedAt !== "number") return false;
  const age = now - draft.savedAt;
  return age >= 0 && age <= DRAFT_MAX_AGE_MS;
}

export function parseDraft(raw: string | null): Draft | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(ANSWERS_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Private mode / storage blocked: the email path still works without the draft.
  }
}

/** Also call this on logout. */
export function clearDraft(): void {
  try {
    localStorage.removeItem(ANSWERS_KEY);
  } catch {
    // ignore
  }
}

/** The stored draft as a raw string (a stable snapshot for useSyncExternalStore); stale drafts are removed. */
export function loadDraftRaw(): string | null {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    if (raw === null) return null;
    if (isDraftFresh(parseDraft(raw))) return raw;
    clearDraft();
    return null;
  } catch {
    return null;
  }
}

export function loadDraft(): Draft | null {
  return parseDraft(loadDraftRaw());
}

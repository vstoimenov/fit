/** The id of the earliest photo (ties: the first in the given order), or null when there are none. */
export function defaultBefore(candidates: { id: string; takenOn: string }[]): string | null {
  let best: { id: string; takenOn: string } | null = null;
  for (const candidate of candidates) {
    // YYYY-MM-DD strings sort chronologically.
    if (!best || candidate.takenOn < best.takenOn) best = candidate;
  }
  return best?.id ?? null;
}

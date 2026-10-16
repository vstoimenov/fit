export const MAX_DIFF_STRING = 300;

/** Display only: shortens long string values (e.g. an article body) so the audit list stays readable. */
export function truncateDiff(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > MAX_DIFF_STRING ? value.slice(0, MAX_DIFF_STRING) + "…" : value;
  }
  if (Array.isArray(value)) return value.map(truncateDiff);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, truncateDiff(v)]));
  }
  return value;
}

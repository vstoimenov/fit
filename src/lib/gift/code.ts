/** Letters and digits that cannot be misread when handwritten or printed (no 0/O, 1/I). */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 10;

/** A fresh voucher code; uniqueness is enforced by the database. */
export function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b & 31];
  return code;
}

/** What a person typed → the stored form: upper case, no dashes/spaces, no "IAM" prefix. */
export function normalizeCode(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.startsWith("IAM") ? compact.slice(3) : compact;
}

/** The printed form: IAM-XXXXX-XXXXX. */
export function formatCode(code: string): string {
  return `IAM-${code.slice(0, 5)}-${code.slice(5)}`;
}

export function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function formInt(form: FormData, key: string): number {
  const raw = formString(form, key);
  const n = /^-?\d+$/.test(raw) ? Number(raw) : Number.NaN;
  return Number.isSafeInteger(n) ? n : Number.NaN;
}

export function formBool(form: FormData, key: string): boolean {
  const value = formString(form, key);
  return value === "on" || value === "true" || value === "1";
}

export function formList(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

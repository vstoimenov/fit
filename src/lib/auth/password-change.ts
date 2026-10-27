/** The password rules of the hosted Supabase project (minimum 10) and bcrypt's 72-byte ceiling. */
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;

export type PasswordChange = { ok: true; password: string } | { ok: false; message: string };

/** Reads „password“ + „confirm“ from the form. Nothing is trimmed: spaces are part of a password. */
export function parsePasswordChange(form: FormData): PasswordChange {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < PASSWORD_MIN) {
    return { ok: false, message: `Паролата трябва да е поне ${PASSWORD_MIN} знака.` };
  }
  if (password.length > PASSWORD_MAX) {
    return { ok: false, message: `Паролата е до ${PASSWORD_MAX} знака.` };
  }
  if (password !== confirm) return { ok: false, message: "Двете пароли не съвпадат." };
  return { ok: true, password };
}

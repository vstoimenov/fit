import { ZodError } from "zod";
import { isAppError } from "@/lib/app-error";

/** What a server action returns to a client form. Never throws across the boundary. */
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(error: unknown): {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string>;
} {
  if (isAppError(error)) return { ok: false, message: error.userMessage };
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return {
      ok: false,
      message: error.issues[0]?.message ?? "Провери въведените данни.",
      fieldErrors,
    };
  }
  console.error("action failed", error instanceof Error ? error.message : error);
  return { ok: false, message: "Нещо се обърка. Опитай отново." };
}

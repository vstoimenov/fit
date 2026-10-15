export type AppErrorCode =
  "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "CONFLICT" | "MFA_REQUIRED";

/** An error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly userMessage: string,
  ) {
    super(userMessage);
    this.name = "AppError";
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

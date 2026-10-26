import { z } from "zod";

/** Empty values in .env files (`KEY=`) count as unset. */
const optionalFromEnv = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

/** Pasted secrets often carry a trailing newline or spaces; trim, then treat blank as unset. */
const trimmedOptional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => {
    const trimmed = typeof v === "string" ? v.trim() : v;
    return trimmed === "" ? undefined : trimmed;
  }, schema.optional());

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Optional: without them „Изпрати съобщение" records the note but sends nothing.
  BREVO_API_KEY: optionalFromEnv(z.string().min(1)),
  EMAIL_FROM_ADDRESS: optionalFromEnv(z.email()),
  EMAIL_FROM_NAME: optionalFromEnv(z.string().min(1).max(60)),
  // Optional: without them checkout shows "not configured" and the webhook answers 503.
  STRIPE_SECRET_KEY: trimmedOptional(
    z.string().regex(/^(sk|rk)_(test|live)_/, "Stripe secret key"),
  ),
  STRIPE_WEBHOOK_SECRET: trimmedOptional(z.string().startsWith("whsec_")),
  // Optional: without a key the nutrition diary has manual entry only (no estimate from words).
  ANTHROPIC_API_KEY: trimmedOptional(z.string().startsWith("sk-ant-")),
  // Optional: overrides the default model (claude-opus-5-5), e.g. a cheaper one.
  NUTRITION_AI_MODEL: optionalFromEnv(z.string().min(1)),
  // Salt for hashing visitor IPs in the lead form's rate limit (any random string, ≥ 16 chars).
  LEADS_SALT: z.string().min(16),
  // Optional: the Brevo list that receives leads from the free workout form (numeric id).
  BREVO_LEADS_LIST_ID: optionalFromEnv(z.string().regex(/^\d+$/, "numeric Brevo list id")),
  // Optional: Web Push (VAPID). Without all three the notifications card says „скоро" and nothing sends.
  // Generate once with `npx web-push generate-vapid-keys`; the public key is also NEXT_PUBLIC_….
  WEB_PUSH_PUBLIC_KEY: trimmedOptional(z.string().min(32)),
  WEB_PUSH_PRIVATE_KEY: trimmedOptional(z.string().min(32)),
  WEB_PUSH_SUBJECT: trimmedOptional(z.string().regex(/^(mailto:|https:)/, "mailto: or https:")),
  // Optional: shared secret Vercel Cron sends as `Authorization: Bearer …` to /api/cron/push.
  CRON_SECRET: trimmedOptional(z.string().min(16)),
  // Optional, temporary testing only: the exact public tunnel host on which testers sign in
  // without a password into their own fresh account (see src/app/dev/login/route.ts). Unset = off.
  TEST_SHARE_HOST: optionalFromEnv(z.string().min(1)),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // "1" shows the Google button; needs the Google provider configured in Supabase.
  NEXT_PUBLIC_GOOGLE_AUTH: z.enum(["0", "1"]).default("0"),
  // Optional: the VAPID public key the browser subscribes with (same value as WEB_PUSH_PUBLIC_KEY).
  NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY: trimmedOptional(z.string().min(32)),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/** Validates `source`; on failure throws one Error naming every bad variable. */
export function parseEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined>,
  scope: "server" | "client",
): z.infer<S> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
  throw new Error(`Invalid ${scope} environment variables: ${names.join(", ")}`);
}

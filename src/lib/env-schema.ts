import { z } from "zod";

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_URL: z.url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // "1" shows the Google button; needs the Google provider configured in Supabase.
  NEXT_PUBLIC_GOOGLE_AUTH: z.enum(["0", "1"]).default("0"),
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

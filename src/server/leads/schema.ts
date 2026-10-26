import { z } from "zod";

/** What a visitor types to unlock the free workout. The e-mail is normalised here and in SQL. */
export const leadSchema = z.object({
  name: z.string().trim().min(2, "Напиши името си").max(60, "До 60 знака"),
  email: z.string().trim().toLowerCase().pipe(z.email("Провери имейла")),
  marketing: z.boolean(),
});

export type LeadInput = z.infer<typeof leadSchema>;

export type LeadFormRead =
  | { kind: "honeypot" }
  | { kind: "input"; input: { name: unknown; email: unknown; marketing: boolean } };

/**
 * Reads the lead form. `website` is a hidden honeypot field: humans never see it, so anything in
 * it means a bot — the caller then pretends to succeed without storing anything.
 */
export function readLeadForm(form: FormData): LeadFormRead {
  const website = form.get("website");
  if (typeof website === "string" && website.length > 0) return { kind: "honeypot" };
  return {
    kind: "input",
    input: {
      name: form.get("name"),
      email: form.get("email"),
      marketing: form.get("marketing") === "on",
    },
  };
}

import { brand } from "@/lib/brand";

export interface Mailer {
  send(msg: {
    to: string;
    toName?: string;
    subject: string;
    text: string;
  }): Promise<{ delivered: boolean }>;
}

/** Brevo transactional email when configured; otherwise a mailer that delivers nothing. */
export function createMailer(
  env: { BREVO_API_KEY?: string; EMAIL_FROM_ADDRESS?: string; EMAIL_FROM_NAME?: string },
  fetchImpl: typeof fetch = fetch,
): Mailer {
  if (!env.BREVO_API_KEY || !env.EMAIL_FROM_ADDRESS) {
    return { send: async () => ({ delivered: false }) };
  }
  const sender = { name: env.EMAIL_FROM_NAME ?? brand.name, email: env.EMAIL_FROM_ADDRESS };
  return {
    async send(msg) {
      try {
        const res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": env.BREVO_API_KEY!,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            sender,
            to: [{ email: msg.to, ...(msg.toName ? { name: msg.toName } : {}) }],
            subject: msg.subject,
            textContent: msg.text,
          }),
          signal: AbortSignal.timeout(10_000),
        });
        return { delivered: res.ok };
      } catch {
        return { delivered: false };
      }
    },
  };
}

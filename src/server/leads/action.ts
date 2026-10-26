"use server";

import { headers } from "next/headers";
import { serverEnv } from "@/env";
import { createMailer } from "@/server/admin/mailer";
import { createServerSupabaseClient } from "@/server/db/server";
import { addBrevoContact } from "./brevo";
import { leadSchema, readLeadForm } from "./schema";
import { hashIp, submitLead } from "./submit";

export type LeadState = { status: "idle" | "ok" | "error"; message?: string; name?: string };

const MESSAGES = {
  rate_limited: "Твърде много опити от тази мрежа. Опитай пак след малко.",
  failed: "Нещо се обърка. Опитай пак след минута.",
} as const;

/** The „unlock the free workout" form: stores the lead, then (best effort) Brevo + an e-mail. */
export async function submitLeadAction(_prev: LeadState, form: FormData): Promise<LeadState> {
  const read = readLeadForm(form);
  if (read.kind === "honeypot") {
    return { status: "ok", name: String(form.get("name") ?? "") };
  }
  const parsed = leadSchema.safeParse(read.input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Провери полетата" };
  }
  const lead = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const db = await createServerSupabaseClient();
  const result = await submitLead(db, lead, hashIp(ip, serverEnv.LEADS_SALT), "free-workout");
  if (!result.ok) return { status: "error", message: MESSAGES[result.error] };

  // Best effort, never blocks the unlock.
  void addBrevoContact(serverEnv, { ...lead, source: "free-workout" });
  void createMailer(serverEnv)
    .send({
      to: lead.email,
      toName: lead.name,
      subject: "Твоята безплатна тренировка",
      text:
        `Здравей, ${lead.name}!\n\n` +
        `Ето линка към безплатната тренировка, за да я пуснеш, когато ти е удобно:\n` +
        `${serverEnv.APP_URL}/trenirovka\n\n` +
        `Когато си готова за план по твоето ниво: ${serverEnv.APP_URL}/start\n\n` +
        `Аксения · I AM STRONG`,
    })
    .catch((error: unknown) => console.error("lead e-mail failed:", error));

  return { status: "ok", name: lead.name };
}

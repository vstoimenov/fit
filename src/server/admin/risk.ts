import { assessRisk, type RiskReason, type RiskThresholds } from "@/lib/admin/risk";
import { renderTemplate, type Settings } from "@/lib/admin/settings";
import type { TypedClient } from "@/server/db/types";
import { listAllClients, type ClientRow } from "./clients";
import type { Mailer } from "./mailer";
import { recordMessage } from "./notes";

export async function listAtRisk(
  db: TypedClient,
  thresholds: RiskThresholds,
  now = new Date(),
  search?: string,
  pageSize?: number,
): Promise<{ client: ClientRow; reasons: RiskReason[] }[]> {
  const rows = await listAllClients(db, { search, pageSize });
  return rows
    .map((client) => ({ client, reasons: assessRisk(client, thresholds, now) }))
    .filter((r) => r.reasons.length > 0)
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length ||
        (a.client.lastDoneAt ?? "").localeCompare(b.client.lastDoneAt ?? ""),
    );
}

/**
 * Emails the nudge template to one client and records what happened as a "message" note.
 * If the email went out but the note could not be saved, this reports `recorded: false` instead of
 * throwing, so the admin does not retry and email the client twice.
 */
export async function sendNudge(
  db: TypedClient,
  mailer: Mailer,
  userId: string,
  templates: Settings["email_templates"],
): Promise<{ delivered: boolean; recorded: boolean }> {
  const { data: profile, error } = await db
    .from("profiles")
    .select("name, email")
    .eq("id", userId)
    .eq("role", "client")
    .single();
  if (error) throw new Error(`load client failed: ${error.message}`);
  const vars = { name: profile.name || "здравей" };
  const subject = renderTemplate(templates.nudgeSubject, vars);
  const text = renderTemplate(templates.nudgeBody, vars);
  const result = await mailer.send({
    to: profile.email,
    toName: profile.name || undefined,
    subject,
    text,
  });
  const prefix = result.delivered
    ? ""
    : "(НЕ Е ИЗПРАТЕНО — няма настроен имейл доставчик или грешка)\n";
  try {
    await recordMessage(db, userId, `${prefix}${subject}\n\n${text}`);
  } catch (recordError) {
    if (!result.delivered) throw recordError;
    console.error(
      "nudge delivered but note not recorded",
      userId,
      recordError instanceof Error ? recordError.message : "unknown error",
    );
    return { delivered: true, recorded: false };
  }
  return { delivered: result.delivered, recorded: true };
}

/**
 * Adds (or updates) a lead as a Brevo contact in the configured list. Best effort: without a key
 * or list id it does nothing, and a failed request is logged, never thrown — the workout unlocks
 * regardless.
 */
export async function addBrevoContact(
  env: { BREVO_API_KEY?: string; BREVO_LEADS_LIST_ID?: string },
  lead: { email: string; name: string; marketing: boolean; source: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ added: boolean }> {
  if (!env.BREVO_API_KEY || !env.BREVO_LEADS_LIST_ID) return { added: false };
  try {
    const res = await fetchImpl("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        email: lead.email,
        updateEnabled: true,
        listIds: [Number(env.BREVO_LEADS_LIST_ID)],
        attributes: { FIRSTNAME: lead.name, SOURCE: lead.source, MARKETING: lead.marketing },
      }),
    });
    if (!res.ok) {
      console.error("brevo contact failed:", res.status);
      return { added: false };
    }
    return { added: true };
  } catch (error) {
    console.error("brevo contact failed:", error);
    return { added: false };
  }
}

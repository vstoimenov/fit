import { describe, expect, it, vi } from "vitest";
import { addBrevoContact } from "./brevo";

const lead = { email: "maria@example.com", name: "Мария", marketing: true, source: "free-workout" };

describe("addBrevoContact", () => {
  it("posts the contact into the configured list", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    const res = await addBrevoContact(
      { BREVO_API_KEY: "key", BREVO_LEADS_LIST_ID: "7" },
      lead,
      fetchImpl as unknown as typeof fetch,
    );
    expect(res).toEqual({ added: true });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/contacts");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("key");
    // A hung Brevo must not hold the serverless function open.
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual({
      email: "maria@example.com",
      updateEnabled: true,
      listIds: [7],
      attributes: { FIRSTNAME: "Мария", SOURCE: "free-workout", MARKETING: true },
    });
  });

  it("does nothing without a key or list", async () => {
    const fetchImpl = vi.fn();
    expect(await addBrevoContact({}, lead, fetchImpl as unknown as typeof fetch)).toEqual({
      added: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never throws on a failed request", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network"));
    expect(
      await addBrevoContact(
        { BREVO_API_KEY: "key", BREVO_LEADS_LIST_ID: "7" },
        lead,
        fetchImpl as unknown as typeof fetch,
      ),
    ).toEqual({ added: false });
  });
});

import { describe, expect, it, vi } from "vitest";
import { createMailer } from "./mailer";

describe("createMailer", () => {
  it("sends through Brevo when configured", async () => {
    const f = vi.fn(
      async () => new Response(JSON.stringify({ messageId: "m1" }), { status: 201 }),
    ) as unknown as typeof fetch;
    const mailer = createMailer(
      { BREVO_API_KEY: "k", EMAIL_FROM_ADDRESS: "hi@example.com", EMAIL_FROM_NAME: "Форма" },
      f,
    );
    expect(
      await mailer.send({ to: "ani@example.test", toName: "Ани", subject: "Тема", text: "Текст" }),
    ).toEqual({ delivered: true });
    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]!;
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("k");
    expect(JSON.parse(String(init.body))).toEqual({
      sender: { name: "Форма", email: "hi@example.com" },
      to: [{ email: "ani@example.test", name: "Ани" }],
      subject: "Тема",
      textContent: "Текст",
    });
  });

  it("reports a Brevo failure as not delivered", async () => {
    const f = vi.fn(async () => new Response("bad", { status: 400 })) as unknown as typeof fetch;
    const mailer = createMailer({ BREVO_API_KEY: "k", EMAIL_FROM_ADDRESS: "hi@example.com" }, f);
    expect(await mailer.send({ to: "a@example.test", subject: "s", text: "t" })).toEqual({
      delivered: false,
    });
  });

  it("falls back to a no-op mailer without configuration", async () => {
    const f = vi.fn() as unknown as typeof fetch;
    expect(
      await createMailer({}, f).send({ to: "a@example.test", subject: "s", text: "t" }),
    ).toEqual({ delivered: false });
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
  });

  it("logs only the status or 'network' on failure, never the key or body", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = vi.fn(
      async () => new Response("secret-body", { status: 401 }),
    ) as unknown as typeof fetch;
    await createMailer({ BREVO_API_KEY: "sekret", EMAIL_FROM_ADDRESS: "hi@example.com" }, bad).send(
      { to: "a@example.test", subject: "s", text: "t" },
    );
    const down = vi.fn(async () => {
      throw new Error("boom sekret");
    }) as unknown as typeof fetch;
    await createMailer(
      { BREVO_API_KEY: "sekret", EMAIL_FROM_ADDRESS: "hi@example.com" },
      down,
    ).send({ to: "a@example.test", subject: "s", text: "t" });
    expect(spy.mock.calls).toEqual([
      ["brevo send failed", 401],
      ["brevo send failed", "network"],
    ]);
    spy.mockRestore();
  });
});

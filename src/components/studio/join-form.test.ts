import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabaseClient: () => ({}) }));

const { JoinForm } = await import("./join-form");

const render = (existingAccount: boolean) =>
  renderToStaticMarkup(
    createElement(JoinForm, {
      title: "Запиши се",
      existingAccount,
      join: async () => ({ ok: true as const }),
      onJoined: async () => {},
    }),
  );

describe("JoinForm", () => {
  it("asks a new client for e-mail and password too", () => {
    const html = render(false);
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });
  it("asks a signed-in client only for name and phone", () => {
    const html = render(true);
    expect(html).toContain('name="phone"');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain("Имам профил");
  });
});

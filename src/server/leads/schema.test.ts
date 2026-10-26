import { describe, expect, it } from "vitest";
import { leadSchema, readLeadForm } from "./schema";

describe("leadSchema", () => {
  it("trims and lower-cases the e-mail", () => {
    const parsed = leadSchema.parse({
      name: " Мария ",
      email: " Maria@Example.COM ",
      marketing: false,
    });
    expect(parsed).toEqual({ name: "Мария", email: "maria@example.com", marketing: false });
  });

  it("rejects a one-character name", () => {
    expect(leadSchema.safeParse({ name: "М", email: "m@x.bg", marketing: false }).success).toBe(
      false,
    );
  });
});

describe("readLeadForm", () => {
  function form(entries: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.set(k, v);
    return f;
  }

  it("flags a filled honeypot", () => {
    expect(readLeadForm(form({ name: "Bot", email: "b@x.bg", website: "http://spam" }))).toEqual({
      kind: "honeypot",
    });
  });

  it("reads the fields and the marketing checkbox", () => {
    expect(
      readLeadForm(form({ name: "Мария", email: "m@x.bg", marketing: "on", website: "" })),
    ).toEqual({
      kind: "input",
      input: { name: "Мария", email: "m@x.bg", marketing: true },
    });
    expect(readLeadForm(form({ name: "Мария", email: "m@x.bg" }))).toEqual({
      kind: "input",
      input: { name: "Мария", email: "m@x.bg", marketing: false },
    });
  });
});

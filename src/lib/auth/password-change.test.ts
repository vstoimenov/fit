import { describe, expect, it } from "vitest";
import { parsePasswordChange } from "./password-change";

const form = (password: string, confirm: string) => {
  const f = new FormData();
  f.set("password", password);
  f.set("confirm", confirm);
  return f;
};

describe("parsePasswordChange", () => {
  it("accepts a matching pair of at least 10 characters", () => {
    expect(parsePasswordChange(form("silna-parola-1", "silna-parola-1"))).toEqual({
      ok: true,
      password: "silna-parola-1",
    });
  });

  it("refuses short passwords with the rule in the message", () => {
    const r = parsePasswordChange(form("kratka", "kratka"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("10");
  });

  it("refuses a confirmation that differs", () => {
    const r = parsePasswordChange(form("silna-parola-1", "silna-parola-2"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("съвпадат");
  });

  it("does not trim: spaces are part of the password", () => {
    expect(parsePasswordChange(form(" silna parola ", " silna parola "))).toMatchObject({
      ok: true,
      password: " silna parola ",
    });
  });

  it("caps the length so the hash stays well defined", () => {
    const long = "a".repeat(73);
    expect(parsePasswordChange(form(long, long)).ok).toBe(false);
  });
});

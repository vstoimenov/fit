import { describe, expect, it } from "vitest";
import { formBool, formInt, formList, formString } from "./form-data";

describe("form-data helpers", () => {
  const form = new FormData();
  form.set("name", "  Ани  ");
  form.set("days", "14");
  form.set("notify", "on");
  form.append("focus", "core");
  form.append("focus", "upper");

  it("reads and trims values", () => {
    expect(formString(form, "name")).toBe("Ани");
    expect(formString(form, "missing")).toBe("");
    expect(formInt(form, "days")).toBe(14);
    expect(Number.isNaN(formInt(form, "name"))).toBe(true);
    expect(formBool(form, "notify")).toBe(true);
    expect(formBool(form, "missing")).toBe(false);
    expect(formList(form, "focus")).toEqual(["core", "upper"]);
  });

  it("rejects integers beyond the safe range", () => {
    const f = new FormData();
    f.set("big", "99999999999999999999");
    expect(Number.isNaN(formInt(f, "big"))).toBe(true);
  });
});

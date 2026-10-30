import { describe, expect, it } from "vitest";
import { attendanceLine, cashLine, telHref } from "./today";

const e = (card: boolean, attended: boolean) => ({
  card: card ? { kind: "card8" as const, remaining: 3 } : null,
  attended,
});

describe("cashLine", () => {
  it("counts the 7 € drop-ins and what to collect from those who came", () => {
    expect(cashLine([e(false, true), e(false, false), e(false, true), e(true, true)])).toBe(
      "7 € на място: записани 3 · дошли 2 = 14 €",
    );
  });
  it("is empty without drop-ins", () => {
    expect(cashLine([e(true, true)])).toBeNull();
  });
});

describe("attendanceLine", () => {
  it("counts who came", () => {
    expect(attendanceLine([e(true, true), e(false, false)])).toBe("Дошли 1 от 2");
  });
});

describe("telHref", () => {
  it("dials the number without spaces", () => {
    expect(telHref("0888 123 456")).toBe("tel:0888123456");
    expect(telHref("+359888123456")).toBe("tel:+359888123456");
  });
});

import { describe, expect, it } from "vitest";
import { redeemErrorMessage } from "./redeem";

describe("redeemErrorMessage", () => {
  it("turns the database reasons into her words", () => {
    expect(redeemErrorMessage("voucher not found")).toMatch(/Няма такъв код/);
    expect(redeemErrorMessage("voucher already used")).toMatch(/вече е използван/);
    expect(redeemErrorMessage("voucher expired")).toMatch(/изтекъл/);
    expect(redeemErrorMessage("paid subscription is live")).toMatch(/абонамент/);
    expect(redeemErrorMessage("something else")).toMatch(/Опитай/);
  });
});

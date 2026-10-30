import { describe, expect, it } from "vitest";
import { mapLinks } from "./map";

describe("mapLinks", () => {
  it("builds an embed and a directions link from the address", () => {
    expect(mapLinks("гр. Плевен, ул. Дойран 12")).toEqual({
      embed:
        "https://www.google.com/maps?q=%D0%B3%D1%80.%20%D0%9F%D0%BB%D0%B5%D0%B2%D0%B5%D0%BD%2C%20%D1%83%D0%BB.%20%D0%94%D0%BE%D0%B9%D1%80%D0%B0%D0%BD%2012&output=embed",
      directions:
        "https://www.google.com/maps/dir/?api=1&destination=%D0%B3%D1%80.%20%D0%9F%D0%BB%D0%B5%D0%B2%D0%B5%D0%BD%2C%20%D1%83%D0%BB.%20%D0%94%D0%BE%D0%B9%D1%80%D0%B0%D0%BD%2012",
    });
  });
});

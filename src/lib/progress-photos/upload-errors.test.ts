import { describe, expect, it } from "vitest";
import { PhotoDecodeError, uploadErrorMessage } from "./upload-errors";

describe("uploadErrorMessage", () => {
  it("asks for JPG or PNG when the photo cannot be decoded", () => {
    expect(uploadErrorMessage(new PhotoDecodeError())).toBe(
      "Не успяхме да отворим снимката. Опитай с JPG или PNG.",
    );
  });

  it("says the photo is too big for a 413 storage error", () => {
    expect(uploadErrorMessage({ statusCode: "413", message: "Payload too large" })).toBe(
      "Снимката е твърде голяма.",
    );
    expect(uploadErrorMessage({ status: 413, message: "x" })).toBe("Снимката е твърде голяма.");
  });

  it("says the photo is too big when the message mentions size", () => {
    expect(uploadErrorMessage(new Error("The object exceeded the maximum allowed size"))).toBe(
      "Снимката е твърде голяма.",
    );
  });

  it("falls back to a retry message for anything else", () => {
    expect(uploadErrorMessage(new Error("network down"))).toBe("Снимката не се качи. Опитай пак.");
    expect(uploadErrorMessage("boom")).toBe("Снимката не се качи. Опитай пак.");
    expect(uploadErrorMessage(null)).toBe("Снимката не се качи. Опитай пак.");
  });
});

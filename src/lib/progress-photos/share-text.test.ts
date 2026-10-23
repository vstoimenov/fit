import { describe, expect, it } from "vitest";
import { progressShareText } from "./share-text";

describe("progressShareText", () => {
  it("puts the site URL on its own line after the message", () => {
    expect(progressShareText("https://x.bg")).toBe("Моят прогрес с I AM STRONG 💪\nhttps://x.bg");
  });

  it("omits the URL line when there is no site URL", () => {
    expect(progressShareText("")).toBe("Моят прогрес с I AM STRONG 💪");
  });
});

import { describe, expect, it } from "vitest";
import { declaredTooLarge, isCrossSite, readCappedText } from "./guards";

describe("isCrossSite", () => {
  it.each([
    [{ secFetchSite: "cross-site", origin: null, host: "app.test" }, true],
    [{ secFetchSite: "same-origin", origin: "https://app.test", host: "app.test" }, false],
    [{ secFetchSite: null, origin: "https://evil.test", host: "app.test" }, true],
    [{ secFetchSite: null, origin: "https://app.test:3120", host: "app.test" }, true],
    [{ secFetchSite: null, origin: "not a url", host: "app.test" }, true],
    [{ secFetchSite: null, origin: null, host: "app.test" }, false],
    [{ secFetchSite: "none", origin: null, host: "app.test" }, false],
  ])("%j → %s", (input, expected) => {
    expect(isCrossSite(input)).toBe(expected);
  });
});

describe("declaredTooLarge", () => {
  it("compares the header to the cap and ignores a missing or malformed one", () => {
    expect(declaredTooLarge("4096")).toBe(false);
    expect(declaredTooLarge("4097")).toBe(true);
    expect(declaredTooLarge(null)).toBe(false);
    expect(declaredTooLarge("abc")).toBe(false);
  });
});

describe("readCappedText", () => {
  const post = (body: string) => new Request("http://app.test", { method: "POST", body });

  it("returns small bodies", async () => {
    expect(await readCappedText(post('{"path":"/"}'))).toBe('{"path":"/"}');
  });

  it("returns null once the body passes the cap, with no content-length needed", async () => {
    expect(await readCappedText(post("x".repeat(4097)))).toBeNull();
    expect(await readCappedText(post("x".repeat(4096)))).toBe("x".repeat(4096));
  });
});

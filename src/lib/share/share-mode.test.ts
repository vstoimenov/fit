import { describe, expect, it } from "vitest";
import { pickShareMode } from "./share-mode";

const file = new File([new Uint8Array([1])], "trenirovka.png", { type: "image/png" });

describe("pickShareMode", () => {
  it("shares the image when the browser can share files", () => {
    expect(pickShareMode({ share: () => {}, canShare: () => true }, file)).toBe("files");
  });

  it("asks canShare about this exact file", () => {
    let seen: File[] = [];
    pickShareMode(
      {
        share: () => {},
        canShare: (data) => {
          seen = data.files;
          return true;
        },
      },
      file,
    );
    expect(seen).toEqual([file]);
  });

  it("shares only the text when files are not supported", () => {
    expect(pickShareMode({ share: () => {}, canShare: () => false }, file)).toBe("text");
    expect(pickShareMode({ share: () => {} }, file)).toBe("text");
  });

  it("treats a throwing canShare as no file support", () => {
    expect(
      pickShareMode(
        {
          share: () => {},
          canShare: () => {
            throw new TypeError("nope");
          },
        },
        file,
      ),
    ).toBe("text");
  });

  it("falls back to download without Web Share", () => {
    expect(pickShareMode({}, file)).toBe("download");
    expect(pickShareMode({ canShare: () => true }, file)).toBe("download");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeImage } from "./decode-image";
import { PhotoDecodeError } from "./upload-errors";

const blob = new Blob(["x"]);

function bitmap(width: number, height: number) {
  return { width, height, close: vi.fn() };
}

function stubImage(outcome: "ok" | "fail") {
  class FakeImage {
    naturalWidth = 30;
    naturalHeight = 20;
    src = "";
    decode() {
      return outcome === "ok" ? Promise.resolve() : Promise.reject(new Error("decode"));
    }
  }
  vi.stubGlobal("Image", FakeImage);
  const createObjectURL = vi.fn(() => "blob:fake");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  return { createObjectURL, revokeObjectURL };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decodeImage", () => {
  it("uses createImageBitmap with the orientation option when it works", async () => {
    const b = bitmap(40, 30);
    const create = vi.fn().mockResolvedValue(b);
    vi.stubGlobal("createImageBitmap", create);
    const decoded = await decodeImage(blob);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(blob, { imageOrientation: "from-image" });
    expect(decoded).toMatchObject({ source: b, width: 40, height: 30 });
    decoded.close();
    expect(b.close).toHaveBeenCalledTimes(1);
  });

  it("retries without options after a TypeError", async () => {
    const b = bitmap(10, 10);
    const create = vi.fn().mockRejectedValueOnce(new TypeError("bad option")).mockResolvedValue(b);
    vi.stubGlobal("createImageBitmap", create);
    const decoded = await decodeImage(blob);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenLastCalledWith(blob);
    expect(decoded.source).toBe(b);
  });

  it("falls back to an <img> and revokes the object URL", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new TypeError("nope")));
    const urls = stubImage("ok");
    const decoded = await decodeImage(blob);
    expect(decoded).toMatchObject({ width: 30, height: 20 });
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    expect(() => decoded.close()).not.toThrow();
  });

  it("goes straight to the <img> when createImageBitmap fails with something other than a TypeError", async () => {
    const create = vi.fn().mockRejectedValue(new Error("InvalidStateError"));
    vi.stubGlobal("createImageBitmap", create);
    stubImage("ok");
    await decodeImage(blob);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("throws PhotoDecodeError only when every route fails, and still revokes the URL", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new TypeError("nope")));
    const urls = stubImage("fail");
    await expect(decodeImage(blob)).rejects.toBeInstanceOf(PhotoDecodeError);
    expect(urls.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});

import { describe, expect, it, vi } from "vitest";
import { sendPush, type PushRow, type PushTransport } from "./send";

const rows: PushRow[] = [
  { id: "a", user_id: "u1", endpoint: "https://p/1", p256dh: "k1", auth: "a1" },
  { id: "b", user_id: "u1", endpoint: "https://p/2", p256dh: "k2", auth: "a2" },
  { id: "c", user_id: "u2", endpoint: "https://p/3", p256dh: "k3", auth: "a3" },
];
const payload = { title: "Здравей", body: "Тест", url: "/app" };

describe("sendPush", () => {
  it("sends to every subscription and counts users, not devices", async () => {
    const transport: PushTransport = vi.fn().mockResolvedValue(undefined);
    const removed: string[] = [];
    const res = await sendPush(rows, payload, transport, (ids) => {
      removed.push(...ids);
      return Promise.resolve();
    });
    expect(transport).toHaveBeenCalledTimes(3);
    expect(JSON.parse((transport as ReturnType<typeof vi.fn>).mock.calls[0][1] as string)).toEqual(
      payload,
    );
    expect(res).toEqual({ users: 2, delivered: 3, pruned: 0, failed: 0 });
    expect(removed).toEqual([]);
  });

  it("prunes subscriptions the push service no longer knows (404/410) and keeps the rest", async () => {
    const gone = Object.assign(new Error("gone"), { statusCode: 410 });
    const transport: PushTransport = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(gone)
      .mockRejectedValueOnce(new Error("network"));
    const removed: string[] = [];
    const res = await sendPush(rows, payload, transport, (ids) => {
      removed.push(...ids);
      return Promise.resolve();
    });
    expect(res).toEqual({ users: 1, delivered: 1, pruned: 1, failed: 1 });
    expect(removed).toEqual(["b"]);
  });

  it("does nothing for no subscriptions", async () => {
    const transport: PushTransport = vi.fn();
    expect(await sendPush([], payload, transport, () => Promise.resolve())).toEqual({
      users: 0,
      delivered: 0,
      pruned: 0,
      failed: 0,
    });
    expect(transport).not.toHaveBeenCalled();
  });
});

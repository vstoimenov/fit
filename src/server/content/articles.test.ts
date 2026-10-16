import { describe, expect, it, vi } from "vitest";
import type { TypedClient } from "@/server/db/types";
import { getArticleBySlug } from "./articles";

describe("getArticleBySlug", () => {
  it.each([
    ["a NUL character", "\u0000"],
    ["uppercase letters", "Abc-def"],
    ["a 2-char slug", "ab"],
    ["an 81-char slug", "a".repeat(81)],
    ["an empty slug", ""],
    ["a slug with a slash", "a/b-c"],
  ])("returns null for %s without querying", async (_label, slug) => {
    const from = vi.fn();
    const db = { from } as unknown as TypedClient;
    expect(await getArticleBySlug(db, slug)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { parseFeed, parsePost } from "./parse";

const row = {
  id: "6d1f0d4e-0000-4000-8000-000000000001",
  body: "Готово!",
  photo_path: null,
  completion_id: null,
  created_at: "2026-10-27T10:00:00+00:00",
  hidden: false,
  mine: true,
  author_name: "Мария П.",
  hearts: 2,
  comments: 1,
  hearted_by_me: false,
};

describe("parseFeed / parsePost", () => {
  it("accepts the RPC rows and drops anything malformed instead of crashing the page", () => {
    expect(parseFeed([row, { junk: true }])).toHaveLength(1);
    expect(parseFeed(null)).toEqual([]);
  });
  it("parses one post with its comments", () => {
    const post = parsePost({
      ...row,
      comments: [
        { id: "c1", body: "Браво", created_at: row.created_at, mine: false, author_name: "Ива К." },
      ],
    });
    expect(post?.comments[0]?.authorName).toBe("Ива К.");
    expect(parsePost(null)).toBeNull();
  });
});

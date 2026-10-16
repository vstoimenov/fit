import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("transliterates Bulgarian to lowercase Latin words joined by dashes", () => {
    expect(slugify("Как да започна")).toBe("kak-da-zapochna");
  });

  it("drops punctuation and symbols, collapsing the gaps", () => {
    expect(slugify("Йога & пилатес!")).toBe("yoga-pilates");
  });

  it("covers the multi-letter sounds", () => {
    expect(slugify("Щастие, жена, цвят, чудо, шоколад, юли, ябълка, България")).toBe(
      "shtastie-zhena-tsvyat-chudo-shokolad-yuli-yabalka-balgariya",
    );
  });

  it("keeps Latin letters and digits, trims and collapses dashes", () => {
    expect(slugify("  --HIIT 20 мин--  ")).toBe("hiit-20-min");
  });

  it("caps the length at 80 without a trailing dash", () => {
    const slug = slugify("дума ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("pads a too-short slug to at least 3 characters", () => {
    expect(slugify("ab").length).toBeGreaterThanOrEqual(3);
    expect(slugify("я").length).toBeGreaterThanOrEqual(3);
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!! ???")).toBe("");
  });

  it("always produces something the database accepts", () => {
    for (const input of ["ab", "я", "Съвети за сън", "x".repeat(200), "100%"]) {
      expect(slugify(input)).toMatch(/^[a-z0-9-]{3,80}$/);
    }
  });
});

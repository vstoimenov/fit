const CYRILLIC: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "y",
  ю: "yu",
  я: "ya",
};

const MAX = 80;
const MIN = 3;

/**
 * An article address from a title: Bulgarian streamlined transliteration, lowercase, anything
 * that is not a letter or digit becomes a single dash. 3–80 characters (the database check);
 * an input with nothing usable gives "".
 */
export function slugify(input: string): string {
  const latin = Array.from(input.toLowerCase(), (ch) => CYRILLIC[ch] ?? ch).join("");
  let slug = latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX)
    .replace(/-+$/g, "");
  if (slug && slug.length < MIN) slug = `${slug}-x`;
  return slug.length < MIN ? "" : slug;
}

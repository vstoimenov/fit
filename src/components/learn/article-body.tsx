import Markdown, { type Components } from "react-markdown";

const EXTERNAL = /^https:\/\//i;
/** What a link may point to: web, mail, same-site paths and in-page anchors. `//host` is not allowed. */
const SAFE_HREF = /^(https?:|mailto:|\/(?!\/)|#)/i;
const IMAGE_SRC = /^(https:\/\/|\/photos\/)/;

/**
 * Markdown from the owner, never trusted as HTML: no `rehype-raw`, so tags in the source are
 * printed as text, and react-markdown's default `urlTransform` drops `javascript:`/`data:` hrefs.
 */
const components: Components = {
  // The page title is the only h1; a "#" in the body is shown as a section heading.
  h1: ({ children }) => (
    <h2 className="mb-3 mt-8 text-2xl font-extrabold tracking-tight">{children}</h2>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-8 text-2xl font-extrabold tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-xl font-extrabold tracking-tight">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-4 text-base leading-[1.7] text-ink">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-1.5 pl-6 leading-[1.7]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-1.5 pl-6 leading-[1.7]">{children}</ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-4 border-line pl-4 italic text-ink-soft">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    // Own allow-list on top of react-markdown's urlTransform; anything else renders as text.
    if (!href || !SAFE_HREF.test(href)) return <>{children}</>;
    const external = EXTERNAL.test(href);
    return (
      <a
        href={href}
        className="font-semibold underline underline-offset-2"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => {
    if (typeof src !== "string" || !IMAGE_SRC.test(src)) return null;
    // eslint-disable-next-line @next/next/no-img-element -- owner-supplied remote URLs; no host allow-list to optimise against
    return (
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="my-4 w-full rounded-2xl"
      />
    );
  },
};

export function ArticleBody({ body }: { body: string }) {
  return (
    <div>
      <Markdown components={components}>{body}</Markdown>
    </div>
  );
}

import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const EXTERNAL = /^https?:\/\//i;
/** What a link may point to: web, mail, same-site paths and in-page anchors. `//host` is not allowed. */
const SAFE_HREF = /^(https?:|mailto:|\/(?!\/)|#)/i;
const IMAGE_SRC = /^(https:\/\/|\/photos\/)/;

/**
 * Markdown from the owner, never trusted as HTML: no `rehype-raw`, so tags in the source are
 * printed as text, and react-markdown's default `urlTransform` drops `javascript:`/`data:` hrefs.
 */
const H3_CLASS = "mb-2 mt-6 text-xl font-extrabold tracking-tight";

const components: Components = {
  // The page title is the only h1; a "#" in the body is shown as a section heading.
  h1: ({ children }) => (
    <h2 className="mb-3 mt-8 text-2xl font-extrabold tracking-tight">{children}</h2>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-8 text-2xl font-extrabold tracking-tight">{children}</h2>
  ),
  h3: ({ children }) => <h3 className={H3_CLASS}>{children}</h3>,
  h4: ({ children }) => <h4 className={H3_CLASS}>{children}</h4>,
  h5: ({ children }) => <h5 className={H3_CLASS}>{children}</h5>,
  h6: ({ children }) => <h6 className={H3_CLASS}>{children}</h6>,
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
        {external && <span className="sr-only"> (отваря се в нов раздел)</span>}
      </a>
    );
  },
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children, style }) => (
    <th style={style} className="border-b-2 border-line px-3 py-2 font-extrabold">
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="border-b border-line px-3 py-2">
      {children}
    </td>
  ),
  img: ({ src, alt }) => {
    if (typeof src !== "string" || !IMAGE_SRC.test(src)) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element -- owner-supplied remote URLs; no host allow-list to optimise against
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
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </Markdown>
    </div>
  );
}

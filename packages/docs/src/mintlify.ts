import { posix } from "node:path";
import { Marked } from "marked";
import { type PageSpec, pages, repoUrl } from "./pages.ts";

export function rewriteLink(href: string, source: string): string {
  if (href.startsWith("#") || /^(?:https?:|mailto:)/i.test(href)) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return "#";
  const [path = "", hash] = href.split("#");
  const target = posix.normalize(posix.join(posix.dirname(source), path));
  const page = pages.find((p) => p.source === target);
  return `${page ? `/sdk/${page.slug}` : `${repoUrl}/blob/main/${target}`}${hash ? `#${hash}` : ""}`;
}

/** Preserve runnable code verbatim while adapting guide links to Mintlify routes. */
export function toMdx(page: PageSpec, markdown: string): string {
  const body = new Marked()
    .lexer(markdown)
    .map((token) => {
      if (token.type === "code") return token.raw;
      if (token.type === "heading" && token.depth === 1) return "";
      return token.raw
        .split(/(`+[^`]*`+)/g)
        .map((part, index) =>
          index % 2
            ? part
            : part.replace(
                /(\[[^\]]*\])\(([^\s)]+)\)/g,
                (_match, label: string, href: string) =>
                  `${label}(${rewriteLink(href, page.source)})`,
              ),
        )
        .join("");
    })
    .join("")
    .trim();
  return `---\ntitle: ${JSON.stringify(page.title)}\ndescription: ${JSON.stringify(page.description)}\n---\n\n${body}\n`;
}

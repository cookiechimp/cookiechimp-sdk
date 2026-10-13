import { readFile } from "node:fs/promises";
import { posix } from "node:path";
import { Marked, type Tokens } from "marked";
import { type PageSpec, pages, repoUrl, skills } from "./pages.ts";
import type { SearchEntry } from "./search.ts";

export interface BuiltPage extends PageSpec {
  markdown: string;
  rawMarkdown?: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Validate deployment input before it enters Markdown links. */
export function docsBaseUrl(value: string): string {
  if (!value) return "";
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "DOCS_BASE_URL must be an https origin without credentials, path, query or hash",
    );
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");

/**
 * Rewrite a link found in `source`. Links to another docs source become that
 * page; other repo-relative links point at GitHub; absolute and hash links stay.
 */
export function rewriteLink(href: string, source: string): string {
  if (href === "llms-full.txt") return href;
  if (href.startsWith("#")) return href;
  if (/^[a-z][a-z0-9+.-]*:/i.test(href))
    return /^(?:https?:|mailto:)/i.test(href) ? href : "#";
  const [path = "", hash] = href.split("#");
  const target = posix.normalize(posix.join(posix.dirname(source), path));
  const page = pages.find((p) => p.source === target);
  if (page)
    return `${page.slug === "index" ? "./" : `${page.slug}.html`}${hash ? `#${hash}` : ""}`;
  return `${repoUrl}/blob/main/${target}${hash ? `#${hash}` : ""}`;
}

function markedFor(source: string): Marked {
  const used = new Map<string, number>();
  return new Marked({
    gfm: true,
    renderer: {
      // Docs are first-party, but raw HTML is still never passed through.
      html: (token: Tokens.HTML | Tokens.Tag) => escapeHtml(token.text),
      heading(
        this: { parser: { parseInline(t: Tokens.Generic[]): string } },
        { tokens, depth, text }: Tokens.Heading,
      ) {
        const base = slugify(text) || "section";
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}">${this.parser.parseInline(tokens)}</a></h${depth}>\n`;
      },
      link(
        this: { parser: { parseInline(t: Tokens.Generic[]): string } },
        { href, title, tokens }: Tokens.Link,
      ) {
        const url = rewriteLink(href, source);
        const external = /^https?:/i.test(url);
        return `<a href="${escapeHtml(url)}"${title ? ` title="${escapeHtml(title)}"` : ""}${external ? ' rel="noopener noreferrer"' : ""}>${this.parser.parseInline(tokens)}</a>`;
      },
    },
  });
}

export function renderMarkdown(markdown: string, source: string): string {
  return markedFor(source).parse(markdown, { async: false }) as string;
}

/** Make relative links in markdown output absolute against the site, for .md and llms files. */
export function rewriteMarkdownLinks(markdown: string, source: string): string {
  return markdown.replace(/\]\(([^)\s]+)\)/g, (_, href: string) => {
    const url = rewriteLink(href, source);
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("#"))
      return `](${url})`;
    const page = url === "./" ? "index.html" : url;
    return `](/${page.replace(/\.html(#|$)/, ".md$1")})`;
  });
}

const nav = (current: string) =>
  pages
    .map(
      (p) =>
        `<li><a href="${p.slug === "index" ? "./" : `${p.slug}.html`}"${p.slug === current ? ' aria-current="page"' : ""}>${escapeHtml(p.title)}</a></li>`,
    )
    .join("");

export const contentSecurityPolicy = (search = false) =>
  `default-src 'none'; style-src 'self'; img-src 'self'; ${search ? "script-src 'self'; connect-src 'self'; " : ""}base-uri 'none'; form-action 'none'`;

const searchForm = `<section id="docs-search" aria-label="Documentation search">
<form role="search"><label for="search-query">Search docs</label>
<div class="search-controls"><input id="search-query" type="search" name="q" maxlength="200" placeholder="Try TcfProvider or script gating" disabled><button type="submit" disabled>Search</button></div></form>
<p role="status" aria-live="polite">Preparing search. If it is unavailable, use the full docs link below.</p>
<ol aria-label="Search results"></ol>
<p><a href="llms-full.txt">Read the full docs</a> and use your browser’s Find command if search is unavailable.</p>
<noscript><p>Enable JavaScript to search interactively.</p></noscript>
</section>`;

export function layout(page: PageSpec, body: string): string {
  const content =
    page.slug === "search" ? body.replace("</h1>", `</h1>${searchForm}`) : body;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(page.slug === "search")}">
<meta name="description" content="${escapeHtml(page.description)}">
<title>${escapeHtml(page.slug === "index" ? page.title : `${page.title} | CookieChimp SDK`)}</title>
<link rel="stylesheet" href="style.css">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="alternate" type="text/markdown" href="${page.slug}.md">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header><a class="brand" href="./">CookieChimp SDK</a><a href="search.html" class="search-link">Search docs</a></header>
<div class="shell">
<nav aria-label="Docs"><ul>${nav(page.slug)}</ul></nav>
<main id="content">
${content}
<footer><a href="${page.slug}.md">View as Markdown</a> · <a href="llms.txt">llms.txt</a> · <a href="${repoUrl}" rel="noopener noreferrer">GitHub</a></footer>
</main>
</div>
${page.slug === "search" ? '<script type="module" src="search.js"></script>' : ""}
</body>
</html>
`;
}

export async function buildPages(root: string): Promise<BuiltPage[]> {
  return Promise.all(
    pages.map(async (page) => {
      const raw = await readFile(posix.join(root, page.source), "utf8");
      return {
        ...page,
        rawMarkdown: raw,
        markdown: rewriteMarkdownLinks(raw, page.source),
        html: layout(page, renderMarkdown(raw, page.source)),
      };
    }),
  );
}

/** llms.txt per https://llmstxt.org: title, summary, then link lists. */
export function llmsTxt(built: BuiltPage[], base = ""): string {
  const link = (path: string) => `${base}/${path}`;
  return `# CookieChimp Consent SDK

> Open-source, lightweight consent SDK for React, Next.js and plain JavaScript. Local mode needs no account; connected mode syncs a CookieChimp project. Includes script and iframe gating, Google Consent Mode v2, IAB GPP and TCF, 33 locales and size budgets enforced in CI.

Packages use the \`@cookiechimp\` npm scope. The SDK never looks up a visitor's location; applications pass trusted region context.

## Docs

${built.map((p) => `- [${p.title}](${link(`${p.slug}.md`)}): ${p.description}`).join("\n")}

## AI skills

${skills.map((s) => `- [${s}](${link(`skills/${s}/SKILL.md`)})`).join("\n")}

## Optional

- [Full docs in one file](${link("llms-full.txt")})
- [Design spec and roadmap](${repoUrl}/blob/main/SPEC.md)
- [Size budgets](${repoUrl}/blob/main/docs/size.md)
`;
}

export function llmsFull(built: BuiltPage[]): string {
  return `${built
    .map(
      (p) => `<!-- page: ${p.slug} (${p.source}) -->\n\n${p.markdown.trim()}\n`,
    )
    .join("\n---\n\n")}`;
}

/** Section anchors use the same heading/id rules as the rendered Markdown. */
export function buildSearchIndex(built: readonly BuiltPage[]): SearchEntry[] {
  const index: SearchEntry[] = [];
  const plain = (value: string) =>
    value
      .replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*>#|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  for (const page of built) {
    if (page.slug === "search") continue;
    const used = new Map<string, number>();
    let title = page.title;
    let url = `${page.slug}.html`;
    let text = "";
    const flush = () => {
      if (text.trim())
        index.push({ title: plain(title), url, text: plain(text) });
    };
    for (const token of new Marked().lexer(page.rawMarkdown ?? page.markdown)) {
      if (token.type === "heading") {
        flush();
        const base = slugify(token.text) || "section";
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        title =
          token.text === page.title
            ? page.title
            : `${page.title}: ${token.text}`;
        url = `${page.slug}.html#${base}${n ? `-${n}` : ""}`;
        text = "";
      } else text += token.raw;
    }
    flush();
  }
  return index;
}

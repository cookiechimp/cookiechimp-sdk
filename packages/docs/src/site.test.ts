import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pages, skills } from "./pages.ts";
import { resolveRequest } from "./serve.ts";
import {
  buildPages,
  docsBaseUrl,
  layout,
  llmsFull,
  llmsTxt,
  renderMarkdown,
  rewriteLink,
  slugify,
} from "./site.ts";

const root = resolve(import.meta.dirname, "../../..");

describe("docs site", () => {
  it("builds every page with nav, CSP and a markdown alternate", async () => {
    const built = await buildPages(root);
    expect(built.map((p) => p.slug)).toEqual(pages.map((p) => p.slug));
    for (const page of built) {
      expect(page.html).toContain("Content-Security-Policy");
      expect(page.html).toContain(`href="${page.slug}.md"`);
      expect(page.html).not.toContain("<script");
      expect(page.html).toMatch(/<h1 id=/);
      expect(page.markdown.trim().length).toBeGreaterThan(200);
    }
  });

  it("rewrites links between docs sources and to GitHub", () => {
    expect(rewriteLink("./SPEC.md", "README.md")).toBe(
      "https://github.com/cookiechimp/cookiechimp-sdk/blob/main/SPEC.md",
    );
    expect(
      rewriteLink(
        "../../nextjs/README.md#pages-router",
        "packages/docs/content/index.md",
      ),
    ).toBe("nextjs.html#pages-router");
    expect(
      rewriteLink("getting-started.md", "packages/docs/content/index.md"),
    ).toBe("getting-started.html");
    expect(rewriteLink("https://llmstxt.org", "README.md")).toBe(
      "https://llmstxt.org",
    );
    expect(rewriteLink("#x", "README.md")).toBe("#x");
  });

  it("never passes raw HTML through and gives headings unique ids", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\n# Hi there\n\n## Hi there\n\n<img src=x onerror="alert(1)">',
      "README.md",
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain('id="hi-there"');
    expect(html).toContain('id="hi-there-1"');
    expect(slugify("IAB `TCF` (EU)!")).toBe("iab-tcf-eu");
  });

  it("escapes page metadata in the layout", () => {
    const html = layout(
      { slug: "x", title: '<b>"T"</b>', description: "<d>", source: "x" },
      "",
    );
    expect(html).toContain("&lt;b&gt;&quot;T&quot;&lt;/b&gt;");
    expect(html).not.toContain("<d>");
  });

  it("writes an llms.txt that follows llmstxt.org and lists every page and skill", async () => {
    const built = await buildPages(root);
    const txt = llmsTxt(built);
    expect(txt.startsWith("# CookieChimp Consent SDK\n\n> ")).toBe(true);
    expect(txt).toMatch(/\n## Docs\n/);
    for (const page of pages)
      expect(txt).toContain(
        `[${page.title}](/${page.slug}.md): ${page.description}`,
      );
    for (const skill of skills)
      expect(txt).toContain(`/skills/${skill}/SKILL.md`);
    expect(llmsTxt(built, "https://docs.example.com")).toContain(
      "(https://docs.example.com/getting-started.md)",
    );
    const full = llmsFull(built);
    for (const page of pages)
      expect(full).toContain(`<!-- page: ${page.slug} `);
    expect(full).not.toMatch(/\]\((?!https?:|#|\/|mailto:)[^)]*\.md/);
  });

  it("ships skills with Agent Skills frontmatter", async () => {
    for (const skill of skills) {
      const text = await readFile(
        resolve(root, "skills", skill, "SKILL.md"),
        "utf8",
      );
      const front = /^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---\n/.exec(
        text,
      );
      expect(front?.[1], skill).toBe(skill);
      expect(front?.[2]?.length, skill).toBeGreaterThan(40);
      expect(front?.[2]?.length, skill).toBeLessThanOrEqual(1024);
    }
  });

  it("uses no em dashes in docs, skills or examples", async () => {
    const files = [
      ...pages.map((p) => p.source),
      ...skills.map((s) => `skills/${s}/SKILL.md`),
      "examples/nextjs-app-router/README.md",
      "examples/nextjs-pages-router/README.md",
    ];
    for (const file of files)
      expect(await readFile(resolve(root, file), "utf8"), file).not.toContain(
        "\u2014",
      );
  });

  it("serves only files inside dist", () => {
    const dist = "/srv/dist";
    expect(resolveRequest(dist, "/")).toBe("/srv/dist/index.html");
    expect(resolveRequest(dist, "/llms.txt?x=1")).toBe("/srv/dist/llms.txt");
    expect(resolveRequest(dist, "/..%2f..%2fpackage.json")).toBeNull();
    expect(resolveRequest(dist, "/%2e%2e%2fsecret")).toBeNull();
    expect(resolveRequest(dist, "/a%00b")).toBeNull();
    expect(resolveRequest(dist, "/%E0%A4%A")).toBeNull();
  });
});

it("rejects executable Markdown links and invalid deployment bases", () => {
  const html = renderMarkdown(
    "[unsafe](javascript:alert%281%29) [ok](https://example.com)",
    "README.md",
  );
  expect(html).not.toContain("javascript:");
  expect(html).toContain('href="https://example.com"');
  expect(docsBaseUrl("")).toBe("");
  expect(docsBaseUrl("https://docs.example.com/")).toBe(
    "https://docs.example.com",
  );
  for (const value of [
    "http://example.com",
    "https://example.com/sdk",
    "https://user:pass@example.com",
    "https://example.com?q=x",
    "https://example.com#fragment",
    "https://",
    "https://example.com?bad\nlink",
  ]) {
    expect(() => docsBaseUrl(value)).toThrow();
  }
});

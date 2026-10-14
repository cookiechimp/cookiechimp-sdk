import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { rewriteLink, toMdx } from "./mintlify.ts";
import { navigation, pages } from "./pages.ts";

it("rewrites cross-guide links and preserves source links and anchors", () => {
  expect(
    rewriteLink(
      "../../nextjs/README.md#pages-router",
      "packages/docs/content/index.md",
    ),
  ).toBe("/sdk/nextjs#pages-router");
  expect(rewriteLink("./SPEC.md", "README.md")).toBe(
    "https://github.com/cookiechimp/cookiechimp-sdk/blob/main/SPEC.md",
  );
  expect(rewriteLink("#choices", "README.md")).toBe("#choices");
  expect(rewriteLink("javascript:alert(1)", "README.md")).toBe("#");
});

it("keeps code examples and inline code unchanged and lets frontmatter own the title", () => {
  const page = pages[0];
  if (!page) throw new Error("Missing overview");
  const code = '```ts\nconst example = "[link](getting-started.md)";\n```';
  const mdx = toMdx(
    page,
    `# Old title\n\n[Setup](getting-started.md)\n\n${code}\n\n\`[link](getting-started.md)\`\n`,
  );
  expect(mdx).toContain("[Setup](/sdk/getting-started)");
  expect(mdx).toContain(code);
  expect(mdx).toContain("`[link](getting-started.md)`");
  expect(mdx).not.toContain("# Old title");
});

it("exports every navigation page from a real source with valid MDX metadata", async () => {
  const paths = navigation.groups.flatMap((group) => group.pages);
  expect(new Set(paths)).toEqual(
    new Set(pages.map(({ slug }) => `sdk/${slug}`)),
  );
  for (const page of pages) {
    const raw = await readFile(
      resolve(import.meta.dirname, "../../..", page.source),
      "utf8",
    );
    const mdx = toMdx(page, raw);
    expect(mdx.startsWith(`---\ntitle: ${JSON.stringify(page.title)}\n`)).toBe(
      true,
    );
    expect(mdx.length).toBeGreaterThan(250);
    expect(mdx).not.toContain("\u2014");
  }
});

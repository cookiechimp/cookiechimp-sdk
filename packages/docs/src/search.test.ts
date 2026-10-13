import { resolve } from "node:path";
import { expect, it } from "vitest";
import { parseIndex, search } from "./search.ts";
import { buildPages, buildSearchIndex, renderMarkdown } from "./site.ts";

it("links the generated index to actual rendered section anchors", async () => {
  const built = await buildPages(resolve(import.meta.dirname, "../../.."));
  const index = buildSearchIndex(built);
  expect(index.length).toBeGreaterThan(50);
  for (const entry of index) {
    const [path, anchor] = entry.url.split("#");
    const page = built.find((page) => `${page.slug}.html` === path);
    expect(page, entry.url).toBeDefined();
    if (anchor) expect(page?.html, entry.url).toContain(`id="${anchor}"`);
  }
  expect(search(index, "TcfProvider")[0]?.url).toContain(
    "reference.html#opt-in-react-tcf-provider",
  );
  expect(search(index, "__tcfapi").length).toBeGreaterThan(0);
});
it("keeps duplicate heading IDs and code containing fake headings aligned", () => {
  const markdown =
    "# Same\n\nFirst text.\n\n## Same\n\nSecond text.\n\n```js\n# This is code\n```";
  const index = buildSearchIndex([
    {
      slug: "test",
      title: "Test",
      description: "",
      source: "",
      markdown,
      html: renderMarkdown(markdown, "README.md"),
    },
  ]);
  expect(index.map((entry) => entry.url)).toEqual([
    "test.html#same",
    "test.html#same-1",
  ]);
  expect(search(index, "This is code")[0]?.url).toBe("test.html#same-1");
});
it("ranks titles, requires every term and normalizes Unicode and case", () => {
  const index = [
    { title: "Other", text: "vendor consent", url: "other.html" },
    { title: "Vendor consent", text: "Café ＡＰＩ", url: "first.html" },
  ];
  expect(search(index, "VENDOR consent")[0]?.url).toBe("first.html");
  expect(search(index, "café api")[0]?.url).toBe("first.html");
  expect(search(index, "vendor missing")).toEqual([]);
  expect(search(index, "   ")).toEqual([]);
});
it("refuses executable, external and traversing links from a malformed index", () => {
  const urls = [
    "javascript:alert(1)",
    "https://evil.example",
    "//evil.example",
    "../index.html",
    "index.html?token=1",
    "nextjs.html#pages-router",
  ];
  expect(
    parseIndex(urls.map((url) => ({ title: "Test", text: "Safe", url }))),
  ).toHaveLength(1);
  expect(parseIndex([null, 1, { title: "Missing fields" }])).toEqual([]);
  expect(() => parseIndex({})).toThrow("Invalid search index");
});

it("uses source heading IDs even when published Markdown links are rewritten", () => {
  const rawMarkdown = "# [API](README.md)\n\nUse the API.";
  const html = renderMarkdown(rawMarkdown, "README.md");
  const [entry] = buildSearchIndex([
    {
      slug: "test",
      title: "Test",
      source: "README.md",
      description: "",
      rawMarkdown,
      markdown: "# [API](/reference.md)\n\nUse the API.",
      html,
    },
  ]);
  expect(entry?.url).toBe("test.html#apireadmemd");
  expect(html).toContain('id="apireadmemd"');
});

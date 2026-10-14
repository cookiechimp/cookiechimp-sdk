import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { skills } from "./pages.ts";
import { buildPages, docsBaseUrl, llmsFull, llmsTxt } from "./site.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const out = resolve(here, "../dist");
// Absolute base URL for llms.txt links, for example https://docs.example.com.
// Unset means root-relative links, so the output works on any host.
const base = docsBaseUrl(process.env.DOCS_BASE_URL ?? "");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const built = await buildPages(root);
for (const page of built) {
  await writeFile(join(out, `${page.slug}.html`), page.html);
  await writeFile(join(out, `${page.slug}.md`), page.markdown);
}
await writeFile(join(out, "llms.txt"), llmsTxt(built, base));
await writeFile(join(out, "llms-full.txt"), llmsFull(built));
await cp(resolve(here, "style.css"), join(out, "style.css"));
await cp(resolve(here, "favicon.svg"), join(out, "favicon.svg"));
// Static hosts that support _headers apply these to every generated file.
await writeFile(
  join(out, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
`,
);
for (const skill of skills) {
  await mkdir(join(out, "skills", skill), { recursive: true });
  await writeFile(
    join(out, "skills", skill, "SKILL.md"),
    await readFile(join(root, "skills", skill, "SKILL.md"), "utf8"),
  );
}
console.log(`docs: ${built.length} pages, ${skills.length} skills -> ${out}`);

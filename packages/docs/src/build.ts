import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toMdx } from "./mintlify.ts";
import { navigation, pages, repoUrl } from "./pages.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const out = resolve(here, "../dist");
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "sdk"), { recursive: true });
for (const page of pages) {
  const markdown = await readFile(join(root, page.source), "utf8");
  await writeFile(join(out, "sdk", `${page.slug}.mdx`), toMdx(page, markdown));
}
await writeFile(
  join(out, "navigation.json"),
  `${JSON.stringify(navigation, null, 2)}\n`,
);
await writeFile(
  join(out, "source.json"),
  `${JSON.stringify(
    {
      repository: repoUrl,
      sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      dirty: Boolean(
        execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
          cwd: root,
          encoding: "utf8",
        }).trim(),
      ),
      pages: pages.map(({ slug, source }) => ({ slug, source })),
    },
    null,
    2,
  )}\n`,
);
console.log(`Mintlify: ${pages.length} SDK pages -> ${out}`);

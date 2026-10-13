import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const dist = resolve(__dirname, "../dist");
const files = readdirSync(dist).filter((file) => file.endsWith(".mjs"));
const read = (file: string) => readFileSync(join(dist, file), "utf8");
const remote = files.filter((file) => /^remote-.*\.mjs$/.test(file));
const NETWORK = [
  "node:http",
  "node:https",
  "node:net",
  "node:dgram",
  "fetch(",
  "globalThis.fetch",
  "XMLHttpRequest",
  "WebSocket",
];

it("only the link and pull chunk has network code", () => {
  expect(files.length).toBeGreaterThan(0);
  expect(remote).toHaveLength(1);
  for (const file of files) {
    const source = read(file);
    if (!remote.includes(file))
      for (const banned of NETWORK)
        expect(source, `${file} contains ${banned}`).not.toContain(banned);
    // Only the package manager is spawned, and never through a shell.
    expect(source).not.toMatch(
      /shell:\s*!0|shell:\s*true|\bexecSync\b|\bexec\(/,
    );
  }
  // Even the link and pull chunk uses fetch only, never raw sockets.
  const source = read(remote[0] as string);
  for (const banned of ["node:http", "node:https", "node:net", "WebSocket"])
    expect(source).not.toContain(banned);
});

it("the bin loads the network chunk only on demand", () => {
  for (const file of files.filter((name) => !remote.includes(name))) {
    const source = read(file);
    if (file === "index.mjs") continue; // the programmatic API re-exports link and pull
    expect(source, file).not.toMatch(/from\s*["'`]\.\/remote-/);
  }
  const main = files.find((file) => file.startsWith("main-")) as string;
  expect(read(main)).toMatch(/import\(\s*[`"']\.\/remote-/);
});

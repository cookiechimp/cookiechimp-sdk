import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

it("the built CLI has no network code", () => {
  const dist = resolve(__dirname, "../dist");
  const files = readdirSync(dist).filter((file) => file.endsWith(".mjs"));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const source = readFileSync(join(dist, file), "utf8");
    for (const banned of [
      "node:http",
      "node:https",
      "node:net",
      "node:dgram",
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
    ])
      expect(source, `${file} contains ${banned}`).not.toContain(banned);
    // Only the package manager is spawned, and never through a shell.
    expect(source).not.toMatch(
      /shell:\s*!0|shell:\s*true|\bexecSync\b|\bexec\(/,
    );
  }
});

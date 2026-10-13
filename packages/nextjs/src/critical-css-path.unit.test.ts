import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("generates critical CSS from checkout paths with spaces and URL characters", () => {
  const root = mkdtempSync(join(tmpdir(), "cc css # "));
  try {
    for (const [source, target] of [
      [
        "../scripts/generate-critical-css.mjs",
        "nextjs/scripts/generate-critical-css.mjs",
      ],
      ["../../react/styles.css", "react/styles.css"],
      ["../../tokens/dist/tokens.css", "tokens/dist/tokens.css"],
    ]) {
      const destination = join(root, target as string);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(
        fileURLToPath(new URL(source as string, import.meta.url)),
        destination,
      );
    }
    mkdirSync(join(root, "nextjs/src"), { recursive: true });
    const result = spawnSync(
      process.execPath,
      [join(root, "nextjs/scripts/generate-critical-css.mjs")],
      { encoding: "utf8" },
    );
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(
      readFileSync(join(root, "nextjs/src/critical-css.generated.ts"), "utf8"),
    ).toContain("position: fixed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  checkDefaultExclusion,
  compareBudget,
  gzipSize,
  main,
  runBudgets,
  type SizeBudget,
} from "./size-harness";

const budget = (entry: string, limit = 100): SizeBudget => ({
  name: "fixture",
  scenario: "fixture",
  entry,
  kind: "initial",
  limit,
});

describe("size harness", () => {
  it("uses the exact Node gzip level 9 result", async () => {
    const input = "CookieChimp".repeat(200);
    expect(await gzipSize(input)).toBe(
      gzipSync(input, { level: 9 }).byteLength,
    );
  });

  it("compares inclusive byte budgets", () => {
    expect(compareBudget(budget("entry", 10), 10).status).toBe("pass");
    expect(compareBudget(budget("entry", 10), 11).status).toBe("fail");
  });

  it("marks missing entries pending and enforces them once present", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    expect((await runBudgets([budget("missing.mjs")], root))[0]?.status).toBe(
      "pending",
    );
    await writeFile(join(root, "missing.mjs"), "export const ready = true;");
    expect((await runBudgets([budget("missing.mjs")], root))[0]?.status).toBe(
      "pass",
    );
  });

  it("detects TCF/GPP code imported by the default bundle", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    await writeFile(join(root, "tcf.mjs"), "export const api = '__tcfapi';");
    await writeFile(
      join(root, "index.mjs"),
      "export { api } from './tcf.mjs';",
    );
    const configured = {
      ...budget("tcf.mjs"),
      excludedFrom: "index.mjs",
      forbiddenTokens: ["__tcfapi", "__gpp"],
    };
    expect(await checkDefaultExclusion(configured, root)).toContain(
      "imports tcf.mjs",
    );
  });

  it("returns a non-zero exit code for an over-budget fixture entry", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    await mkdir(join(root, "fixture"));
    await writeFile(
      join(root, "fixture/large.mjs"),
      `export default '${"abcdefghijklmnopqrstuvwxyz".repeat(30)}';`,
    );
    await writeFile(
      join(root, "size-budgets.json"),
      JSON.stringify([budget("fixture/large.mjs", 1)]),
    );
    expect(await main(root)).toBe(1);
  });
});

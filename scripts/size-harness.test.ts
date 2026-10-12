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

  it("keeps an allowlisted planned entry pending and enforces it once present", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    const entry = "packages/react/dist/banner.mjs";
    const plannedBudget = { ...budget(entry), planned: true as const };
    expect((await runBudgets([plannedBudget], root))[0]?.status).toBe(
      "pending",
    );
    await mkdir(join(root, "packages/react/dist"), { recursive: true });
    await writeFile(join(root, entry), "export const ready = true;");
    expect((await runBudgets([plannedBudget], root))[0]?.status).toBe("pass");
  });

  it.each(["__tcfapi", "__gpp"])(
    "fails when the core output contains %s while the TCF entry is absent",
    async (token) => {
      const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
      await writeFile(
        join(root, "index.mjs"),
        `export const api = '${token}';`,
      );
      const configured = {
        ...budget("packages/core/dist/tcf.mjs"),
        planned: true as const,
        excludedFrom: "index.mjs",
        forbiddenTokens: ["__tcfapi", "__gpp"],
      };
      const result = (await runBudgets([configured], root))[0];
      expect(result).toMatchObject({
        status: "fail",
        detail: `default bundle contains ${token}`,
      });
    },
  );

  it("passes the default-bundle guard for clean core output", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    await writeFile(join(root, "index.mjs"), "export const clean = true;");
    const configured = {
      ...budget("packages/core/dist/tcf.mjs"),
      planned: true as const,
      excludedFrom: "index.mjs",
      forbiddenTokens: ["__tcfapi", "__gpp"],
    };
    expect(await checkDefaultExclusion(configured, root)).toBeUndefined();
    expect((await runBudgets([configured], root))[0]?.status).toBe("pending");
  });

  it("fails an unknown missing path with a clear message", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    const result = (await runBudgets([budget("typo/banner.mjs")], root))[0];
    expect(result).toMatchObject({
      status: "fail",
      detail: "missing entry is not an approved planned entry: typo/banner.mjs",
    });
    await writeFile(
      join(root, "size-budgets.json"),
      JSON.stringify([budget("typo/banner.mjs")]),
    );
    expect(await main(root)).toBe(1);
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

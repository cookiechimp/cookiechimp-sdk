import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  bundleEntry,
  checkDefaultExclusion,
  compareBudget,
  gzipSize,
  main,
  measureEntry,
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
  it("keeps every documented budget aligned with size-budgets.json", async () => {
    const root = join(import.meta.dirname, "..");
    const configured = JSON.parse(
      await readFile(join(root, "size-budgets.json"), "utf8"),
    ) as SizeBudget[];
    const docs = await readFile(join(root, "docs/size.md"), "utf8");
    const block = docs.match(
      /<!-- size-budgets:start -->([\s\S]*?)<!-- size-budgets:end -->/,
    )?.[1];
    expect(block, "marked size budget table").toBeDefined();
    const documented = [
      ...(block ?? "").matchAll(
        /^\| (.+?) \| (initial|total|extra|lazy) \| (\d+) \|$/gm,
      ),
    ].map(([, name, kind, limit]) => ({ name, kind, limit: Number(limit) }));
    expect(documented).toEqual(
      configured.map(({ name, kind, limit }) => ({ name, kind, limit })),
    );
  });

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

  it("bundles code reached through a bare package import", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    const packageA = join(root, "package-a");
    const packageB = join(root, "package-b");
    await mkdir(join(packageA, "node_modules"), { recursive: true });
    await mkdir(packageB);
    await writeFile(
      join(packageB, "package.json"),
      JSON.stringify({ name: "fixture-b", exports: "./index.mjs" }),
    );
    const marker = "B_PACKAGE_UNIQUE_7f91c3a8_".repeat(20);
    await writeFile(
      join(packageB, "index.mjs"),
      `export const value = '${marker}'`,
    );
    await symlink(packageB, join(packageA, "node_modules/fixture-b"), "dir");
    const entry = join(packageA, "index.mjs");
    const alone = join(packageA, "alone.mjs");
    await writeFile(
      entry,
      "import { value } from 'fixture-b'; export const result = value;",
    );
    await writeFile(alone, "export const result = ''; ");

    const bundled = await bundleEntry(entry, "total");
    expect(
      bundled?.measuredChunks.map(({ code }) => code).join("\n"),
    ).toContain(marker);
    expect(await measureEntry(entry, "total")).toBeGreaterThan(
      (await measureEntry(alone, "total")) ?? 0,
    );
  });

  it("leaves React external", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    const entry = join(root, "index.mjs");
    await writeFile(
      entry,
      "import React from 'react'; export const result = React.createElement;",
    );
    const bundled = await bundleEntry(entry, "total");
    const code = bundled?.measuredChunks.map((chunk) => chunk.code).join("\n");
    expect(code).toContain('from"react"');
    expect(code).not.toContain("createContext");
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

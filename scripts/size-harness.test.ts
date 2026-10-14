import { mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  bundleEntry,
  checkDefaultExclusion,
  compareBudget,
  gzipSize,
  inlineCss,
  main,
  measureCss,
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
        /^\| (.+?) \| (initial|total|extra|lazy) \| (\d+|INFO) \|$/gm,
      ),
    ].map(([, name, kind, limit]) => ({
      name,
      kind,
      limit: limit === "INFO" ? undefined : Number(limit),
    }));
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

  it("includes core runtime code in a source scenario measurement", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-scenario-"));
    const modules = join(root, "node_modules");
    const reactPackage = join(modules, "@cookiechimp/react");
    const corePackage = join(modules, "@cookiechimp/core");
    await mkdir(reactPackage, { recursive: true });
    await mkdir(corePackage, { recursive: true });
    await writeFile(
      join(reactPackage, "package.json"),
      JSON.stringify({ name: "@cookiechimp/react", exports: "./index.mjs" }),
    );
    await writeFile(
      join(corePackage, "package.json"),
      JSON.stringify({ name: "@cookiechimp/core", exports: "./index.mjs" }),
    );
    await writeFile(
      join(corePackage, "index.mjs"),
      "export const createConsent = () => 'CORE_RUNTIME_UNIQUE_31d76f';",
    );
    await writeFile(
      join(reactPackage, "index.mjs"),
      "import { createConsent } from '@cookiechimp/core'; export const ConsentProvider = () => createConsent();",
    );
    const entry = join(root, "scenario.ts");
    await writeFile(
      entry,
      "import { ConsentProvider } from '@cookiechimp/react'; export const Scenario = ConsentProvider;",
    );

    const bundled = await bundleEntry(entry, "initial");
    expect(
      bundled?.measuredChunks.map(({ code }) => code).join("\n"),
    ).toContain("CORE_RUNTIME_UNIQUE_31d76f");
  });

  it("inlines imported CSS and adds its gzip bytes to a scenario", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-css-"));
    const tokens = join(root, "node_modules/@cookiechimp/tokens");
    await mkdir(tokens, { recursive: true });
    await writeFile(
      join(tokens, "package.json"),
      JSON.stringify({
        name: "@cookiechimp/tokens",
        exports: { "./css": "./tokens.css" },
      }),
    );
    await writeFile(
      join(tokens, "tokens.css"),
      ":root{--unique-token:#123456}",
    );
    const styles = join(root, "styles.css");
    await writeFile(
      styles,
      '@import "@cookiechimp/tokens/css";\n.banner{color:var(--unique-token)}',
    );
    const inlined = await inlineCss(styles);
    expect(inlined).toContain("--unique-token:#123456");
    expect(inlined).not.toContain("@import");
    const entry = join(root, "scenario.mjs");
    await writeFile(entry, "export const scenario = 'rendered';");
    const jsBytes = await measureEntry(entry, "initial");
    const result = (
      await runBudgets(
        [{ ...budget("scenario.mjs"), css: ["styles.css"] }],
        root,
      )
    )[0];
    expect(result?.bytes).toBe((jsBytes ?? 0) + (await measureCss([styles])));
  });

  it("reports informational rows without failing when they exceed a limit", async () => {
    expect(
      compareBudget({ ...budget("entry", 1), informational: true }, 1000),
    ).toMatchObject({ status: "info", bytes: 1000 });
  });

  it("excludes informational rows from the enforced summary count", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    await writeFile(join(root, "entry.mjs"), "export const value = true;");
    await writeFile(
      join(root, "size-budgets.json"),
      JSON.stringify([
        budget("entry.mjs"),
        { ...budget("entry.mjs"), informational: true },
      ]),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const table = vi.spyOn(console, "table").mockImplementation(() => {});
    await expect(main(root)).resolves.toBe(0);
    expect(log).toHaveBeenCalledWith("\n1 enforced, 0 pending");
    log.mockRestore();
    table.mockRestore();
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
    const entry = "packages/core/dist/tcf.mjs";
    const plannedBudget = { ...budget(entry), planned: true as const };
    expect((await runBudgets([plannedBudget], root))[0]?.status).toBe(
      "pending",
    );
    await mkdir(join(root, "packages/core/dist"), { recursive: true });
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

  it("adds alsoEntries to a row and fails closed when one is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "cookiechimp-size-"));
    await writeFile(join(root, "a.mjs"), "export const a = 'a'.repeat(1);");
    await writeFile(join(root, "b.mjs"), "export const b = 'bbbbbbbbbb';");
    const alone = (await runBudgets([budget("a.mjs")], root))[0]?.bytes ?? 0;
    const other = (await runBudgets([budget("b.mjs")], root))[0]?.bytes ?? 0;
    const combined = (
      await runBudgets([{ ...budget("a.mjs"), alsoEntries: ["b.mjs"] }], root)
    )[0];
    expect(combined?.bytes).toBe(alone + other);
    const missing = (
      await runBudgets(
        [{ ...budget("a.mjs"), alsoEntries: ["missing.mjs"] }],
        root,
      )
    )[0];
    expect(missing?.status).toBe("fail");
  });

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

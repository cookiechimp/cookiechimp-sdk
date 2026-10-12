import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { constants, gzip } from "node:zlib";

const gzipAsync = promisify(gzip);
export type BudgetKind = "initial" | "total" | "extra" | "lazy";
export interface SizeBudget {
  name: string;
  scenario: string;
  entry: string;
  kind: BudgetKind;
  limit: number;
  excludedFrom?: string;
  forbiddenTokens?: string[];
}
export interface BudgetResult extends SizeBudget {
  bytes?: number;
  status: "pass" | "fail" | "pending";
  detail?: string;
}

export async function gzipSize(input: Uint8Array | string): Promise<number> {
  return (await gzipAsync(input, { level: constants.Z_BEST_COMPRESSION }))
    .byteLength;
}

export function compareBudget(
  budget: SizeBudget,
  bytes: number | undefined,
): BudgetResult {
  if (bytes === undefined) return { ...budget, status: "pending" };
  return { ...budget, bytes, status: bytes <= budget.limit ? "pass" : "fail" };
}

const importPattern =
  /(?:import\s*(?:[^"']*?from\s*)?|export\s+[^"']*?from\s*|import\s*\()(["'])(\.[^"']+)\1/g;

async function moduleFiles(
  entry: string,
  includeLazy: boolean,
): Promise<string[]> {
  const seen = new Set<string>();
  async function visit(file: string): Promise<void> {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      if (!includeLazy && match[0].startsWith("import(")) continue;
      const target = match[2];
      if (target) await visit(resolve(dirname(file), target));
    }
  }
  await visit(entry);
  return [...seen].sort();
}

export async function measureEntry(
  entry: string,
  kind: BudgetKind,
): Promise<number | undefined> {
  if (!existsSync(entry)) return undefined;
  const files = await moduleFiles(entry, kind !== "initial");
  const sizes = await Promise.all(
    files.map(async (file) => gzipSize(await readFile(file))),
  );
  return sizes.reduce((sum, size) => sum + size, 0);
}

export async function checkDefaultExclusion(
  budget: SizeBudget,
  root: string,
): Promise<string | undefined> {
  if (!budget.excludedFrom || !existsSync(resolve(root, budget.entry)))
    return undefined;
  const defaultEntry = resolve(root, budget.excludedFrom);
  if (!existsSync(defaultEntry))
    return `default entry missing: ${budget.excludedFrom}`;
  const files = await moduleFiles(defaultEntry, true);
  if (files.includes(resolve(root, budget.entry)))
    return `default bundle imports ${budget.entry}`;
  const source = (
    await Promise.all(files.map((file) => readFile(file, "utf8")))
  ).join("\n");
  const token = budget.forbiddenTokens?.find((candidate) =>
    source.includes(candidate),
  );
  return token ? `default bundle contains ${token}` : undefined;
}

export async function runBudgets(
  budgets: SizeBudget[],
  root: string,
): Promise<BudgetResult[]> {
  return Promise.all(
    budgets.map(async (budget) => {
      const result = compareBudget(
        budget,
        await measureEntry(resolve(root, budget.entry), budget.kind),
      );
      if (result.status !== "pending") {
        const detail = await checkDefaultExclusion(budget, root);
        if (detail) return { ...result, status: "fail" as const, detail };
      }
      return result;
    }),
  );
}

const formatBytes = (bytes: number | undefined): string =>
  bytes === undefined ? "-" : `${bytes} B`;

export function printTable(results: BudgetResult[]): void {
  console.table(
    results.map(({ scenario, kind, bytes, limit, status, detail }) => ({
      scenario,
      kind,
      "size gzip -9": formatBytes(bytes),
      limit: `${limit} B`,
      status: status.toUpperCase(),
      ...(detail ? { detail } : {}),
    })),
  );
}

export async function main(
  root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
): Promise<number> {
  const budgets = JSON.parse(
    await readFile(resolve(root, "size-budgets.json"), "utf8"),
  ) as SizeBudget[];
  const results = await runBudgets(budgets, root);
  printTable(results);
  const pending = results.filter(({ status }) => status === "pending").length;
  console.log(`\n${results.length - pending} enforced, ${pending} pending`);
  return results.some(({ status }) => status === "fail") ? 1 : 0;
}

const isCli =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) process.exitCode = await main();

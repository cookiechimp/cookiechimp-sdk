import { readFile } from "node:fs/promises";
import { dirname, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { constants, gzip } from "node:zlib";
import { type OutputChunk, rolldown } from "rolldown";

const gzipAsync = promisify(gzip);
export type BudgetKind = "initial" | "total" | "extra" | "lazy";
export interface SizeBudget {
  name: string;
  scenario: string;
  entry: string;
  kind: BudgetKind;
  limit: number;
  planned?: true;
  excludedFrom?: string;
  forbiddenTokens?: string[];
}
export interface BudgetResult extends SizeBudget {
  bytes?: number;
  status: "pass" | "fail" | "pending";
  detail?: string;
}

export const plannedEntries = new Set([
  "packages/react/dist/banner.mjs",
  "packages/react/dist/index.mjs",
  "packages/core/dist/sync.mjs",
  "packages/core/dist/tcf.mjs",
]);

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

const alwaysExternal = new Set([
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
]);

async function peerDependencies(entry: string): Promise<Set<string>> {
  let directory = dirname(entry);
  const { root } = parse(directory);
  while (directory !== root) {
    try {
      const manifest = JSON.parse(
        await readFile(resolve(directory, "package.json"), "utf8"),
      ) as { peerDependencies?: Record<string, string> };
      return new Set(Object.keys(manifest.peerDependencies ?? {}));
    } catch {
      directory = dirname(directory);
    }
  }
  return new Set();
}

export interface BundledEntry {
  chunks: OutputChunk[];
  measuredChunks: OutputChunk[];
}

export async function bundleEntry(
  entry: string,
  kind: BudgetKind,
  treeshake = true,
): Promise<BundledEntry | undefined> {
  try {
    await readFile(entry);
  } catch {
    return undefined;
  }
  const peers = await peerDependencies(entry);
  const external = (specifier: string): boolean =>
    [...alwaysExternal, ...peers].some(
      (peer) => specifier === peer || specifier.startsWith(`${peer}/`),
    );
  const build = await rolldown({
    input: entry,
    external,
    treeshake,
    onLog(level, log, handler) {
      if (log.code === "UNRESOLVED_IMPORT") throw new Error(log.message);
      if (log.code !== "MODULE_LEVEL_DIRECTIVE") handler(level, log);
    },
  });
  try {
    const generated = await build.generate({
      format: "esm",
      minify: true,
      codeSplitting: kind === "initial",
    });
    const chunks = generated.output.filter(
      (output): output is OutputChunk => output.type === "chunk",
    );
    return {
      chunks,
      measuredChunks:
        kind === "initial" ? chunks.filter((chunk) => chunk.isEntry) : chunks,
    };
  } finally {
    await build.close();
  }
}

export async function measureEntry(
  entry: string,
  kind: BudgetKind,
): Promise<number | undefined> {
  const bundled = await bundleEntry(entry, kind);
  if (!bundled) return undefined;
  const sizes = await Promise.all(
    bundled.measuredChunks.map((chunk) => gzipSize(chunk.code)),
  );
  return sizes.reduce((sum, size) => sum + size, 0);
}

export async function checkDefaultExclusion(
  budget: SizeBudget,
  root: string,
): Promise<string | undefined> {
  if (!budget.excludedFrom) return undefined;
  const defaultEntry = resolve(root, budget.excludedFrom);
  const bundled = await bundleEntry(defaultEntry, "total", false);
  if (!bundled) return `default entry missing: ${budget.excludedFrom}`;
  const modules = bundled.chunks.flatMap((chunk) => Object.keys(chunk.modules));
  if (modules.includes(resolve(root, budget.entry)))
    return `default bundle imports ${budget.entry}`;
  const source = bundled.chunks.map((chunk) => chunk.code).join("\n");
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
      const detail = await checkDefaultExclusion(budget, root);
      if (detail) return { ...result, status: "fail" as const, detail };
      if (
        result.status === "pending" &&
        (!budget.planned || !plannedEntries.has(budget.entry))
      )
        return {
          ...result,
          status: "fail" as const,
          detail: `missing entry is not an approved planned entry: ${budget.entry}`,
        };
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

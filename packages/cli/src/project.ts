import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Framework = "next-app" | "next-pages" | "react" | "vanilla";
export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";
export const PACKAGE_MANAGERS: readonly PackageManager[] = [
  "pnpm",
  "npm",
  "yarn",
  "bun",
];

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

export interface Project {
  root: string;
  pkg: PackageJson;
  framework: Framework;
  packageManager: PackageManager;
  /** "src" when the app code lives under src/, otherwise "". */
  srcDir: string;
}

export class CliError extends Error {}

/** Read package.json as data only. Project code is never imported or run. */
export function readPackageJson(root: string): PackageJson {
  const file = join(root, "package.json");
  if (!existsSync(file))
    throw new CliError(
      `No package.json found in ${root}. Run this in your project root.`,
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    throw new CliError(`${file} is not valid JSON.`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new CliError(`${file} must contain a JSON object.`);
  const pkg = parsed as Record<string, unknown>;
  const deps = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : undefined;
  return {
    name: typeof pkg.name === "string" ? pkg.name : undefined,
    dependencies: deps(pkg.dependencies),
    devDependencies: deps(pkg.devDependencies),
    packageManager:
      typeof pkg.packageManager === "string" ? pkg.packageManager : undefined,
  };
}

export function dependency(pkg: PackageJson, name: string): string | undefined {
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
}

export function detectPackageManager(
  root: string,
  pkg: PackageJson,
): PackageManager {
  const declared = pkg.packageManager?.split("@")[0];
  if (declared && (PACKAGE_MANAGERS as readonly string[]).includes(declared))
    return declared as PackageManager;
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock")))
    return "bun";
  return "npm";
}

/** Detect the framework from dependencies and the folders Next.js routes from. */
export function detectProject(root: string): Project {
  const pkg = readPackageJson(root);
  const has = (dir: string) => existsSync(join(root, dir));
  let framework: Framework = "vanilla";
  let srcDir = has("src") ? "src" : "";
  if (dependency(pkg, "next")) {
    if (has("app") || has("src/app")) {
      framework = "next-app";
      srcDir = has("app") ? "" : "src";
    } else {
      framework = "next-pages";
      srcDir = has("pages") ? "" : has("src/pages") ? "src" : "";
    }
  } else if (dependency(pkg, "react")) framework = "react";
  return {
    root,
    pkg,
    framework,
    packageManager: detectPackageManager(root, pkg),
    srcDir,
  };
}

export const PACKAGES: Record<Framework, readonly string[]> = {
  "next-app": [
    "@cookiechimp/core",
    "@cookiechimp/react",
    "@cookiechimp/nextjs",
  ],
  "next-pages": [
    "@cookiechimp/core",
    "@cookiechimp/react",
    "@cookiechimp/nextjs",
  ],
  react: ["@cookiechimp/core", "@cookiechimp/react"],
  vanilla: ["@cookiechimp/core"],
};

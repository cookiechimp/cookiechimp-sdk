import { spawnSync } from "node:child_process";
import {
  CliError,
  detectProject,
  type Framework,
  PACKAGE_MANAGERS,
  PACKAGES,
  type PackageManager,
} from "./project";
import { safeWrite, type WriteResult } from "./safe-write";
import { scaffold } from "./templates";

export type Runner = (
  command: string,
  args: readonly string[],
  cwd: string,
) => { status: number | null; error?: Error };

/** Runs the package manager directly, never through a shell, so nothing in the arguments is interpreted. */
export const defaultRunner: Runner = (command, args, cwd) =>
  spawnSync(command, args, { cwd, stdio: "inherit", shell: false });

export interface InitOptions {
  cwd: string;
  install?: boolean;
  force?: boolean;
  dryRun?: boolean;
  packageManager?: string;
  framework?: string;
  runner?: Runner;
  platform?: NodeJS.Platform;
}

export interface InitResult {
  framework: Framework;
  packageManager: PackageManager;
  install: {
    command: string;
    args: string[];
    status: "ran" | "skipped" | "manual";
  };
  files: { path: string; result: WriteResult }[];
  instructions: string[];
}

const FRAMEWORKS: readonly Framework[] = [
  "next-app",
  "next-pages",
  "react",
  "vanilla",
];

export function installArgs(pm: PackageManager, packages: readonly string[]) {
  return [pm === "npm" ? "install" : "add", ...packages];
}

export function runInit(options: InitOptions): InitResult {
  const project = detectProject(options.cwd);
  if (
    options.packageManager !== undefined &&
    !(PACKAGE_MANAGERS as readonly string[]).includes(options.packageManager)
  )
    throw new CliError(`--pm must be one of ${PACKAGE_MANAGERS.join(", ")}`);
  if (
    options.framework !== undefined &&
    !(FRAMEWORKS as readonly string[]).includes(options.framework)
  )
    throw new CliError(`--framework must be one of ${FRAMEWORKS.join(", ")}`);
  const framework = (options.framework as Framework) ?? project.framework;
  const pm =
    (options.packageManager as PackageManager) ?? project.packageManager;
  const args = installArgs(pm, PACKAGES[framework]);
  let status: InitResult["install"]["status"] = "skipped";
  if (options.install !== false && !options.dryRun) {
    // Windows package managers are .cmd shims that cannot run without a shell,
    // so print the command there rather than invoke a shell.
    if ((options.platform ?? process.platform) === "win32") status = "manual";
    else {
      const run = (options.runner ?? defaultRunner)(pm, args, project.root);
      if (run.error || run.status !== 0)
        throw new CliError(
          `${pm} ${args.join(" ")} failed${run.error ? `: ${run.error.message}` : ""}`,
        );
      status = "ran";
    }
  }
  const { files, instructions } = scaffold(framework, project.srcDir);
  return {
    framework,
    packageManager: pm,
    install: { command: pm, args, status },
    files: files.map(({ path, content }) => ({
      path,
      result: safeWrite(project.root, path, content, {
        force: options.force,
        dryRun: options.dryRun,
      }),
    })),
    instructions,
  };
}

import { runDoctor } from "./doctor";
import { runInit } from "./init";
import { CliError } from "./project";

const USAGE = `Usage: cookiechimp <command> [options]

Commands:
  init     Detect your framework, install CookieChimp and scaffold a provider
  doctor   Check that CookieChimp is installed and wired up
  link     Pick a CookieChimp site with an API token and write its project id to .env.local
  pull     Save the dashboard config of the linked site to cookiechimp.config.json

Options:
  --cwd <dir>            Project directory (default: current directory)
  --pm <name>            pnpm, npm, yarn or bun (init; default: detected)
  --framework <name>     next-app, next-pages, react or vanilla (init; default: detected)
  --no-install           Scaffold files without installing packages (init)
  --force                Overwrite files that already exist (init)
  --dry-run              Show what a command would do without changing anything
  --project <id>         Project id to link or pull (default: picked, or read from the env file)
  --env-file <path>      Env file for link and pull (default: .env.local)
  --out <path>           Output file for pull (default: cookiechimp.config.json)
  --api <url>            CookieChimp API origin (default: https://cookiechimp.com)
  --token-stdin          Read the API token for link from stdin instead of COOKIECHIMP_API_TOKEN
  --json                 Print machine-readable output
  -h, --help             Show this help`;

interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
  cwd: () => string;
  /** Network and terminal access for link and pull. */
  remote?: () => import("./remote").RemoteIo;
}

const VALUE_FLAGS = new Set([
  "--cwd",
  "--pm",
  "--framework",
  "--project",
  "--env-file",
  "--out",
  "--api",
]);
const BOOL_FLAGS = new Set([
  "--no-install",
  "--force",
  "--dry-run",
  "--json",
  "--token-stdin",
  "--help",
  "-h",
]);

export function parseArgs(argv: readonly string[]) {
  const [command, ...rest] = argv;
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] as string;
    const [name, inline] = arg.startsWith("--")
      ? arg.split(/=(.*)/s, 2)
      : [arg];
    if (VALUE_FLAGS.has(name as string)) {
      const value = inline ?? rest[++i];
      if (value === undefined || value.startsWith("--"))
        throw new CliError(`${name} needs a value`);
      values[name as string] = value;
    } else if (BOOL_FLAGS.has(arg)) flags.add(arg);
    else throw new CliError(`Unknown option: ${arg}`);
  }
  return { command, values, flags };
}

const failure = (io: Io, json: boolean, error: unknown): number => {
  if (error instanceof CliError) {
    io.err(
      json
        ? JSON.stringify({ ok: false, error: error.message })
        : error.message,
    );
    return 1;
  }
  throw error;
};

/**
 * Run the CLI and return its exit code: 0 ok, 1 failed, 2 usage error.
 * `link` and `pull` use the network and return a Promise.
 */
export function main(
  argv: readonly string[],
  io: Io = {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
    cwd: () => process.cwd(),
  },
): number | Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    io.err(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const { command, values, flags } = parsed;
  if (
    !command ||
    command === "--help" ||
    command === "-h" ||
    flags.has("--help") ||
    flags.has("-h")
  ) {
    io.out(USAGE);
    return command &&
      !["--help", "-h"].includes(command) &&
      !["init", "doctor", "link", "pull"].includes(command)
      ? 2
      : 0;
  }
  const cwd = values["--cwd"] ?? io.cwd();
  const json = flags.has("--json");
  try {
    if (command === "init") {
      const result = runInit({
        cwd,
        install: !flags.has("--no-install"),
        force: flags.has("--force"),
        dryRun: flags.has("--dry-run"),
        packageManager: values["--pm"],
        framework: values["--framework"],
      });
      if (json) io.out(JSON.stringify(result, null, 2));
      else {
        io.out(`Detected ${result.framework}, using ${result.packageManager}.`);
        const command = `${result.install.command} ${result.install.args.join(" ")}`;
        if (result.install.status === "ran") io.out(`Installed: ${command}`);
        else io.out(`Install with: ${command}`);
        for (const file of result.files)
          io.out(
            `${file.result === "skipped" ? "Kept existing" : flags.has("--dry-run") ? "Would write" : "Wrote"} ${file.path}${file.result === "skipped" ? " (use --force to replace)" : ""}`,
          );
        io.out("\nNext steps:");
        for (const line of result.instructions) io.out(line);
      }
      return 0;
    }
    if (command === "doctor") {
      const { checks } = runDoctor(cwd);
      const failed = checks.some((check) => check.status === "fail");
      if (json) io.out(JSON.stringify({ ok: !failed, checks }, null, 2));
      else
        for (const check of checks)
          io.out(
            `${check.status === "pass" ? "ok  " : check.status === "warn" ? "warn" : "FAIL"} ${check.message}`,
          );
      return failed ? 1 : 0;
    }
    if (command === "link" || command === "pull")
      return runRemote(command, values, flags, cwd, io).catch((error) =>
        failure(io, json, error),
      );
    io.err(`Unknown command: ${command}\n\n${USAGE}`);
    return 2;
  } catch (error) {
    return failure(io, json, error);
  }
}

async function runRemote(
  command: "link" | "pull",
  values: Record<string, string>,
  flags: Set<string>,
  cwd: string,
  io: Io,
): Promise<number> {
  // Loaded only here, so init and doctor never load network code.
  const remote = await import("./remote");
  const remoteIo = io.remote?.() ?? (await import("./terminal")).terminalIo();
  const json = flags.has("--json");
  const dryRun = flags.has("--dry-run");
  if (command === "link") {
    const result = await remote.runLink(
      {
        cwd,
        project: values["--project"],
        api: values["--api"],
        envFile: values["--env-file"],
        tokenStdin: flags.has("--token-stdin"),
        dryRun,
      },
      remoteIo,
    );
    if (json) io.out(JSON.stringify({ ok: true, ...result }, null, 2));
    else {
      io.out(`Linked ${result.site.name} (${result.site.id}).`);
      io.out(
        result.changed
          ? `${dryRun ? "Would set" : "Set"} ${result.envKey} in ${result.envFile}${result.previous && result.previous !== result.site.id ? ` (was ${result.previous})` : ""}.`
          : `${result.envFile} already has ${result.envKey}=${result.site.id}.`,
      );
      io.out(
        "The API token was not saved. Run `cookiechimp pull` to save the dashboard config for offline builds.",
      );
    }
    return 0;
  }
  const result = await remote.runPull(
    {
      cwd,
      project: values["--project"],
      api: values["--api"],
      envFile: values["--env-file"],
      out: values["--out"],
      dryRun,
    },
    remoteIo,
  );
  if (json) io.out(JSON.stringify({ ok: true, ...result }, null, 2));
  else
    io.out(
      `${dryRun ? "Would write" : "Wrote"} ${result.out} for ${result.projectId} (${result.banners} banner${result.banners === 1 ? "" : "s"}, ${result.bytes} bytes${result.cacheVersion ? `, version ${result.cacheVersion}` : ""}).`,
    );
  return 0;
}

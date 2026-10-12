import { runDoctor } from "./doctor";
import { runInit } from "./init";
import { CliError } from "./project";

const USAGE = `Usage: cookiechimp <command> [options]

Commands:
  init     Detect your framework, install CookieChimp and scaffold a provider
  doctor   Check that CookieChimp is installed and wired up

Options:
  --cwd <dir>            Project directory (default: current directory)
  --pm <name>            pnpm, npm, yarn or bun (init; default: detected)
  --framework <name>     next-app, next-pages, react or vanilla (init; default: detected)
  --no-install           Scaffold files without installing packages (init)
  --force                Overwrite files that already exist (init)
  --dry-run              Show what init would do without changing anything
  --json                 Print machine-readable output
  -h, --help             Show this help`;

interface Io {
  out: (text: string) => void;
  err: (text: string) => void;
  cwd: () => string;
}

const VALUE_FLAGS = new Set(["--cwd", "--pm", "--framework"]);
const BOOL_FLAGS = new Set([
  "--no-install",
  "--force",
  "--dry-run",
  "--json",
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

/** Run the CLI and return its exit code: 0 ok, 1 failed, 2 usage error. */
export function main(
  argv: readonly string[],
  io: Io = {
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
    cwd: () => process.cwd(),
  },
): number {
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
      !["init", "doctor"].includes(command)
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
    io.err(`Unknown command: ${command}\n\n${USAGE}`);
    return 2;
  } catch (error) {
    if (error instanceof CliError) {
      io.err(
        json
          ? JSON.stringify({ ok: false, error: error.message })
          : error.message,
      );
      return 1;
    }
    throw error;
  }
}

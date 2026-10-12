import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runDoctor } from "./doctor";
import { installArgs, runInit } from "./init";
import { main, parseArgs } from "./main";
import { CliError, detectProject } from "./project";
import { safePath, safeWrite } from "./safe-write";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function project(files: Record<string, string>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cc-cli-")));
  roots.push(root);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}
const pkg = (deps: Record<string, string> = {}, extra: object = {}) =>
  JSON.stringify({ name: "app", dependencies: deps, ...extra });
const okRunner = () => vi.fn(() => ({ status: 0 }));

describe("detectProject", () => {
  it.each([
    [
      { "package.json": pkg({ next: "16.0.0" }), "app/page.tsx": "" },
      "next-app",
      "",
    ],
    [
      { "package.json": pkg({ next: "16.0.0" }), "src/app/page.tsx": "" },
      "next-app",
      "src",
    ],
    [
      { "package.json": pkg({ next: "15.0.0" }), "pages/index.tsx": "" },
      "next-pages",
      "",
    ],
    [
      { "package.json": pkg({ react: "19.0.0" }), "src/main.tsx": "" },
      "react",
      "src",
    ],
    [{ "package.json": pkg() }, "vanilla", ""],
  ] as const)("detects %#", (files, framework, srcDir) => {
    const found = detectProject(project(files));
    expect(found.framework).toBe(framework);
    expect(found.srcDir).toBe(srcDir);
  });

  it.each([
    [{ "pnpm-lock.yaml": "" }, "pnpm"],
    [{ "yarn.lock": "" }, "yarn"],
    [{ "bun.lock": "" }, "bun"],
    [{}, "npm"],
  ] as const)("detects the package manager from lockfiles %#", (files, pm) => {
    expect(
      detectProject(project({ "package.json": pkg(), ...files }))
        .packageManager,
    ).toBe(pm);
  });

  it("prefers a valid packageManager field and ignores an unknown one", () => {
    expect(
      detectProject(
        project({ "package.json": pkg({}, { packageManager: "yarn@4.0.0" }) }),
      ).packageManager,
    ).toBe("yarn");
    expect(
      detectProject(
        project({ "package.json": pkg({}, { packageManager: "evil;rm@1" }) }),
      ).packageManager,
    ).toBe("npm");
  });

  it.each([
    ["missing", {}],
    ["invalid JSON", { "package.json": "{nope" }],
    ["an array", { "package.json": "[]" }],
  ])("rejects a package.json that is %s", (_name, files) => {
    expect(() => detectProject(project(files))).toThrow(CliError);
  });

  it("ignores non-string dependency values", () => {
    const root = project({
      "package.json": JSON.stringify({
        dependencies: { next: { evil: true }, react: "19" },
      }),
    });
    expect(detectProject(root).framework).toBe("react");
  });
});

describe("safe writes", () => {
  it("writes new files and keeps existing ones unless forced", () => {
    const root = project({ "package.json": pkg(), "a.ts": "mine" });
    expect(safeWrite(root, "b/c.ts", "new")).toBe("written");
    expect(readFileSync(join(root, "b/c.ts"), "utf8")).toBe("new");
    expect(safeWrite(root, "a.ts", "theirs")).toBe("skipped");
    expect(readFileSync(join(root, "a.ts"), "utf8")).toBe("mine");
    expect(safeWrite(root, "a.ts", "theirs", { force: true })).toBe(
      "overwritten",
    );
    expect(readFileSync(join(root, "a.ts"), "utf8")).toBe("theirs");
  });

  it("writes nothing on a dry run", () => {
    const root = project({ "package.json": pkg() });
    expect(safeWrite(root, "x/y.ts", "z", { dryRun: true })).toBe("written");
    expect(existsSync(join(root, "x"))).toBe(false);
  });

  it.each([
    "../escape.ts",
    "a/../../escape.ts",
    "/etc/passwd",
    "..\\escape.ts",
  ])("refuses to write outside the project: %s", (file) => {
    const root = project({ "package.json": pkg() });
    expect(() => safeWrite(root, file, "x")).toThrow(/outside the project/);
  });

  it("refuses a symlinked folder that leaves the project", () => {
    const outside = project({});
    const root = project({ "package.json": pkg() });
    symlinkSync(outside, join(root, "components"));
    expect(() =>
      safeWrite(root, "components/cookiechimp-banner.tsx", "x"),
    ).toThrow(/link that leaves the project/);
    expect(existsSync(join(outside, "cookiechimp-banner.tsx"))).toBe(false);
  });

  it("refuses to overwrite a symlinked file, even with force", () => {
    const outside = project({ "secret.txt": "keep" });
    const root = project({ "package.json": pkg() });
    symlinkSync(
      join(outside, "secret.txt"),
      join(root, "cookiechimp.config.ts"),
    );
    expect(() =>
      safeWrite(root, "cookiechimp.config.ts", "x", { force: true }),
    ).toThrow(/symbolic link/);
    expect(readFileSync(join(outside, "secret.txt"), "utf8")).toBe("keep");
  });

  it("accepts paths inside the project", () => {
    const root = project({ "package.json": pkg() });
    expect(safePath(root, "src/components/x.tsx")).toBe(
      join(root, "src/components/x.tsx"),
    );
  });
});

describe("init", () => {
  it.each([
    [
      "next-app",
      { next: "16.0.0", react: "19.0.0" },
      { "app/layout.tsx": "" },
      ["cookiechimp.config.ts", "components/cookiechimp-banner.tsx"],
      ["@cookiechimp/core", "@cookiechimp/react", "@cookiechimp/nextjs"],
    ],
    [
      "next-pages",
      { next: "15.0.0", react: "19.0.0" },
      { "pages/_app.tsx": "" },
      ["cookiechimp.config.ts", "components/cookiechimp-provider.tsx"],
      ["@cookiechimp/core", "@cookiechimp/react", "@cookiechimp/nextjs"],
    ],
    [
      "react",
      { react: "19.0.0" },
      { "src/main.tsx": "" },
      ["src/cookiechimp.config.ts", "src/components/cookiechimp-provider.tsx"],
      ["@cookiechimp/core", "@cookiechimp/react"],
    ],
    [
      "vanilla",
      {},
      {},
      ["cookiechimp.config.ts", "cookiechimp.ts"],
      ["@cookiechimp/core"],
    ],
  ] as const)(
    "scaffolds and installs for %s",
    (framework, deps, files, written, packages) => {
      const root = project({
        "package.json": pkg(deps),
        "pnpm-lock.yaml": "",
        ...files,
      });
      const runner = okRunner();
      const result = runInit({ cwd: root, runner, platform: "linux" });
      expect(result.framework).toBe(framework);
      expect(runner).toHaveBeenCalledWith("pnpm", ["add", ...packages], root);
      expect(result.install.status).toBe("ran");
      expect(result.files.map(({ path }) => path)).toEqual(written);
      for (const file of written)
        expect(existsSync(join(root, file))).toBe(true);
      expect(result.instructions.length).toBeGreaterThan(0);
    },
  );

  it("never changes existing project files", () => {
    const layout = "export default function L(){return null}";
    const root = project({
      "package.json": pkg({ next: "16", react: "19" }),
      "app/layout.tsx": layout,
    });
    runInit({ cwd: root, install: false });
    expect(readFileSync(join(root, "app/layout.tsx"), "utf8")).toBe(layout);
    expect(readFileSync(join(root, "package.json"), "utf8")).toBe(
      pkg({ next: "16", react: "19" }),
    );
  });

  it.each(["npm; rm -rf /", "pnpm && curl evil", "$(id)", "../npm", "PNPM"])(
    "rejects an unknown package manager %s before installing or writing",
    (pm) => {
      const root = project({ "package.json": pkg() });
      const runner = okRunner();
      expect(() => runInit({ cwd: root, packageManager: pm, runner })).toThrow(
        /--pm must be/,
      );
      expect(runner).not.toHaveBeenCalled();
      expect(existsSync(join(root, "cookiechimp.config.ts"))).toBe(false);
    },
  );

  it("rejects an unknown framework before installing or writing", () => {
    const root = project({ "package.json": pkg() });
    const runner = okRunner();
    expect(() => runInit({ cwd: root, framework: "angular", runner })).toThrow(
      /--framework/,
    );
    expect(runner).not.toHaveBeenCalled();
    expect(existsSync(join(root, "cookiechimp.config.ts"))).toBe(false);
  });

  it("passes install arguments as an array, never a shell string", () => {
    expect(installArgs("npm", ["@cookiechimp/core"])).toEqual([
      "install",
      "@cookiechimp/core",
    ]);
    expect(installArgs("yarn", ["@cookiechimp/core"])).toEqual([
      "add",
      "@cookiechimp/core",
    ]);
  });

  it("stops before writing when the install fails", () => {
    const root = project({ "package.json": pkg() });
    expect(() =>
      runInit({ cwd: root, runner: () => ({ status: 1 }), platform: "linux" }),
    ).toThrow(/failed/);
    expect(existsSync(join(root, "cookiechimp.config.ts"))).toBe(false);
  });

  it("prints the install command on Windows instead of spawning a shell", () => {
    const root = project({ "package.json": pkg() });
    const runner = okRunner();
    const result = runInit({ cwd: root, runner, platform: "win32" });
    expect(runner).not.toHaveBeenCalled();
    expect(result.install.status).toBe("manual");
  });

  it("dry run neither installs nor writes", () => {
    const root = project({ "package.json": pkg() });
    const runner = okRunner();
    const result = runInit({ cwd: root, runner, dryRun: true });
    expect(runner).not.toHaveBeenCalled();
    expect(result.install.status).toBe("skipped");
    expect(existsSync(join(root, "cookiechimp.config.ts"))).toBe(false);
  });

  it("skips files that exist and replaces them with force", () => {
    const root = project({
      "package.json": pkg(),
      "cookiechimp.config.ts": "mine",
    });
    expect(runInit({ cwd: root, install: false }).files[0]?.result).toBe(
      "skipped",
    );
    expect(readFileSync(join(root, "cookiechimp.config.ts"), "utf8")).toBe(
      "mine",
    );
    expect(
      runInit({ cwd: root, install: false, force: true }).files[0]?.result,
    ).toBe("overwritten");
  });
});

describe("doctor", () => {
  const status = (root: string, id: string) =>
    runDoctor(root).checks.find((check) => check.id === id)?.status;
  const wiredLayout =
    'import { CookieChimpProvider } from "@cookiechimp/nextjs/server";\nexport default function L({children}){return <CookieChimpProvider config={c}>{children}</CookieChimpProvider>}';
  const nextDeps = {
    next: "16.0.0",
    react: "19.0.0",
    "@cookiechimp/core": "^1.0.0",
    "@cookiechimp/react": "^1.0.0",
    "@cookiechimp/nextjs": "^1.0.0",
  };

  it("passes a set-up Next.js project", () => {
    const root = project({
      "package.json": pkg(nextDeps),
      "app/layout.tsx": wiredLayout,
      "cookiechimp.config.ts": "",
    });
    expect(
      runDoctor(root).checks.every((check) => check.status === "pass"),
    ).toBe(true);
  });

  it("fails when packages or the provider are missing", () => {
    const root = project({
      "package.json": pkg({ next: "16", react: "19" }),
      "app/layout.tsx": "",
    });
    expect(status(root, "packages")).toBe("fail");
    expect(status(root, "provider")).toBe("fail");
    expect(status(root, "config")).toBe("warn");
  });

  it("warns on mismatched versions and old React or Next.js", () => {
    const root = project({
      "package.json": pkg({
        ...nextDeps,
        next: "13.5.0",
        react: "17.0.2",
        "@cookiechimp/react": "^0.9.0",
      }),
      "app/layout.tsx": wiredLayout,
    });
    expect(status(root, "versions")).toBe("warn");
    expect(status(root, "react")).toBe("warn");
    expect(status(root, "next")).toBe("warn");
  });

  it.each([
    [
      '<script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>',
      "warn",
    ],
    [
      "<script src='https://connect.facebook.net/en_US/fbevents.js'></script>",
      "warn",
    ],
    [
      '<script type="text/plain" data-cc-src="https://www.googletagmanager.com/gtag/js" data-cc-category="analytics"></script>',
      "pass",
    ],
    ['<script src="/local.js"></script>', "pass"],
  ])("flags ungated tracking scripts: %s", (html, expected) => {
    const root = project({
      "package.json": pkg({ react: "19" }),
      "index.html": html,
    });
    expect(status(root, "ungated-scripts")).toBe(expected);
  });

  it("does not follow an entry file symlinked outside the project", () => {
    const outside = project({ "layout.tsx": wiredLayout });
    const root = project({ "package.json": pkg(nextDeps) });
    mkdirSync(join(root, "app"));
    symlinkSync(join(outside, "layout.tsx"), join(root, "app/layout.tsx"));
    expect(status(root, "provider")).toBe("fail");
  });

  it("skips oversized files", () => {
    const root = project({
      "package.json": pkg(nextDeps),
      "app/layout.tsx": `${" ".repeat(1_000_001)}CookieChimpProvider`,
    });
    expect(status(root, "provider")).toBe("fail");
  });
});

describe("main", () => {
  const io = (cwd: string) => {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      io: {
        out: (t: string) => out.push(t),
        err: (t: string) => err.push(t),
        cwd: () => cwd,
      },
    };
  };

  it("prints help and returns 0", () => {
    const { out, io: handle } = io("/");
    expect(main(["--help"], handle)).toBe(0);
    expect(out.join("\n")).toContain("cookiechimp <command>");
  });

  it.each([
    [["bogus"]],
    [["init", "--nope"]],
    [["init", "--pm"]],
    [["init", "--cwd", "--force"]],
  ])("returns 2 for usage errors %j", (argv) => {
    const { err, io: handle } = io("/");
    expect(main(argv, handle)).toBe(2);
    expect(err.join("\n")).toMatch(/Unknown|needs a value/);
  });

  it("parses inline and separate values", () => {
    expect(
      parseArgs(["init", "--pm=yarn", "--cwd", "x", "--force"]),
    ).toMatchObject({
      command: "init",
      values: { "--pm": "yarn", "--cwd": "x" },
    });
  });

  it("runs doctor with --json and returns 1 on failure", () => {
    const root = project({ "package.json": pkg({ react: "19" }) });
    const { out, io: handle } = io(root);
    expect(main(["doctor", "--json"], handle)).toBe(1);
    expect(JSON.parse(out.join("")).ok).toBe(false);
  });

  it("runs init without installing via --cwd and reports CliErrors as 1", () => {
    const root = project({ "package.json": pkg() });
    const { out, io: handle } = io("/nowhere");
    expect(main(["init", "--no-install", "--cwd", root], handle)).toBe(0);
    expect(out.join("\n")).toContain("Wrote cookiechimp.config.ts");
    const failed = io(project({}));
    expect(main(["doctor"], failed.io)).toBe(1);
    expect(failed.err.join("")).toContain("No package.json");
  });
});

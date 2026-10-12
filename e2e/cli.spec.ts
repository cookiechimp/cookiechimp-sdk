import { spawnSync } from "node:child_process";
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
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";

const cli = resolve("packages/cli/dist/cli.mjs");
const run = (args: string[], cwd: string) =>
  spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8" });

const temps: string[] = [];
test.afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});
function temp(files: Record<string, string>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cc-cli-e2e-")));
  temps.push(root);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), content);
  }
  return root;
}

test("init scaffolds a Next.js app, then doctor passes once it is wired up", () => {
  const layout =
    "export default function RootLayout({ children }) {\n  return <html><body>{children}</body></html>;\n}\n";
  const root = temp({
    "package.json": JSON.stringify({
      name: "app",
      dependencies: { next: "16.4.0", react: "19.3.0" },
    }),
    "pnpm-lock.yaml": "",
    "app/layout.tsx": layout,
  });
  const init = run(["init", "--no-install"], root);
  expect(init.status).toBe(0);
  expect(init.stdout).toContain("Detected next-app, using pnpm.");
  expect(init.stdout).toContain(
    "Install with: pnpm add @cookiechimp/core @cookiechimp/react @cookiechimp/nextjs",
  );
  expect(readFileSync(join(root, "app/layout.tsx"), "utf8")).toBe(layout);
  expect(existsSync(join(root, "cookiechimp.config.ts"))).toBe(true);
  expect(existsSync(join(root, "components/cookiechimp-banner.tsx"))).toBe(
    true,
  );

  const before = JSON.parse(run(["doctor", "--json"], root).stdout);
  expect(before.ok).toBe(false);

  // Simulate the install and the printed layout edit.
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const name of [
    "@cookiechimp/core",
    "@cookiechimp/react",
    "@cookiechimp/nextjs",
  ])
    pkg.dependencies[name] = "^0.1.0";
  writeFileSync(join(root, "package.json"), JSON.stringify(pkg));
  writeFileSync(
    join(root, "app/layout.tsx"),
    'import { CookieChimpProvider } from "@cookiechimp/nextjs/server";\nimport { consentConfig } from "../cookiechimp.config";\nexport default function RootLayout({ children }) {\n  return <html><body><CookieChimpProvider config={consentConfig}>{children}</CookieChimpProvider></body></html>;\n}\n',
  );
  const after = run(["doctor", "--json"], root);
  expect(after.status).toBe(0);
  expect(
    JSON.parse(after.stdout).checks.every(
      (check: { status: string }) => check.status === "pass",
    ),
  ).toBe(true);

  const again = run(["init", "--no-install"], root);
  expect(again.status).toBe(0);
  expect(again.stdout).toContain("Kept existing cookiechimp.config.ts");
});

test("doctor passes on the real Next.js fixture app", () => {
  const result = run(
    ["doctor", "--json", "--cwd", resolve("fixtures/nextjs-app")],
    process.cwd(),
  );
  const report = JSON.parse(result.stdout);
  expect(result.status).toBe(0);
  expect(report.ok).toBe(true);
  expect(
    report.checks.find((check: { id: string }) => check.id === "provider")
      .status,
  ).toBe("pass");
});

test("doctor flags an ungated tracking script and missing setup", () => {
  const root = temp({
    "package.json": JSON.stringify({ dependencies: { react: "19.3.0" } }),
    "index.html":
      '<script async src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>',
  });
  const result = run(["doctor", "--json"], root);
  expect(result.status).toBe(1);
  const statuses = Object.fromEntries(
    JSON.parse(result.stdout).checks.map(
      (check: { id: string; status: string }) => [check.id, check.status],
    ),
  );
  expect(statuses).toMatchObject({
    packages: "fail",
    provider: "fail",
    "ungated-scripts": "warn",
  });
});

test("init refuses to write through a link that leaves the project", () => {
  const outside = temp({});
  const root = temp({
    "package.json": JSON.stringify({ dependencies: { next: "16.4.0" } }),
    "app/layout.tsx": "",
  });
  symlinkSync(outside, join(root, "components"));
  const result = run(["init", "--no-install"], root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("leaves the project");
  expect(existsSync(join(outside, "cookiechimp-banner.tsx"))).toBe(false);
});

test("init rejects a package manager with shell syntax and runs nothing", () => {
  const root = temp({ "package.json": "{}" });
  const result = run(["init", "--pm", "npm; touch pwned"], root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("--pm must be one of");
  expect(existsSync(join(root, "pwned"))).toBe(false);
  expect(existsSync(join(root, "cookiechimp.config.ts"))).toBe(false);
});

test("usage errors exit with 2", () => {
  const result = run(["init", "--unknown"], process.cwd());
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("Unknown option: --unknown");
});

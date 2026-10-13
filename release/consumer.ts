import { execFileSync, spawn } from "node:child_process";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const directory = resolve(import.meta.dirname, "consumer");
const artifacts = resolve(import.meta.dirname, "artifacts");
const manifest = JSON.parse(
  await readFile(join(artifacts, "manifest.json"), "utf8"),
);
await rm(directory, { recursive: true, force: true });
await mkdir(join(directory, "app"), { recursive: true });
const dependencies: Record<string, string> = {
  next: "16.4.0",
  react: "19.3.0",
  "react-dom": "19.3.0",
  typescript: "7.0.2",
  "@types/node": "22.20.5",
  "@types/react": "19.3.0",
  "@types/react-dom": "19.3.0",
};
for (const entry of manifest.packages)
  dependencies[entry.name] = `file:${join(artifacts, entry.file)}`;
await writeFile(
  join(directory, "package.json"),
  JSON.stringify(
    {
      name: "cookiechimp-packed-consumer",
      private: true,
      type: "module",
      dependencies,
    },
    null,
    2,
  ),
);
execFileSync(
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--package-lock=false",
    "--no-audit",
    "--no-fund",
  ],
  { cwd: directory, stdio: "inherit" },
);
const require = createRequire(join(directory, "package.json"));
const statements: string[] = [];
const standaloneStatements: string[] = [];
let count = 0;
for (const entry of manifest.packages) {
  const folder = join(directory, "node_modules", entry.name);
  if ((await lstat(folder)).isSymbolicLink())
    throw new Error("Consumer resolved a workspace symlink");
  const packed = JSON.parse(
    await readFile(join(folder, "package.json"), "utf8"),
  );
  if (packed.version !== "1.0.0")
    throw new Error("Consumer resolved another SDK version");
  for (const [subpath, value] of Object.entries(packed.exports ?? {})) {
    const specifier = entry.name + (subpath === "." ? "" : subpath.slice(1));
    if (specifier.endsWith("/json")) continue;
    statements.push(
      `import * as p${count} from ${JSON.stringify(specifier)}; void p${count};`,
    );
    // Styles have no exports, so check them as bare imports instead.
    if (specifier.endsWith(".css") || specifier.endsWith("/css"))
      statements[statements.length - 1] =
        `import ${JSON.stringify(specifier)};`;
    if (!specifier.startsWith("@cookiechimp/nextjs"))
      standaloneStatements.push(statements[statements.length - 1] as string);
    const target = value as { import?: string; require?: string };
    if (
      !specifier.startsWith("@cookiechimp/nextjs") &&
      typeof target.import === "string"
    ) {
      const file = join(folder, target.import);
      const imported = await import(file);
      if (!Object.keys(imported).length)
        throw new Error(`Empty ESM export: ${specifier}`);
      if (target.require) require(specifier);
    }
    count++;
  }
}
await writeFile(join(directory, "exports.ts"), `${statements.join("\n")}\n`);
await writeFile(
  join(directory, "exports-standalone.ts"),
  `${standaloneStatements.join("\n")}\n`,
);
await writeFile(
  join(directory, "tsconfig.exports.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2024",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        skipLibCheck: false,
        noEmit: true,
        types: ["node"],
      },
      include: ["exports-standalone.ts"],
    },
    null,
    2,
  ),
);
execFileSync(
  join(directory, "node_modules/.bin/tsc"),
  ["--project", "tsconfig.exports.json"],
  { cwd: directory, stdio: "inherit" },
);
const fullTypes = JSON.parse(
  await readFile(join(directory, "tsconfig.exports.json"), "utf8"),
);
fullTypes.compilerOptions.skipLibCheck = true;
fullTypes.include = ["exports.ts"];
await writeFile(
  join(directory, "tsconfig.exports-next.json"),
  JSON.stringify(fullTypes, null, 2),
);
execFileSync(
  join(directory, "node_modules/.bin/tsc"),
  ["--project", "tsconfig.exports-next.json"],
  { cwd: directory, stdio: "inherit" },
);
await writeFile(
  join(directory, "app/layout.tsx"),
  `import "@cookiechimp/react/styles.css";
import { CookieChimpProvider } from "@cookiechimp/nextjs/server";
import { CookieBanner } from "@cookiechimp/react/banner";
import type { ReactNode } from "react";
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><CookieChimpProvider config={{ categories: { analytics: false }, regulation: "gdpr" }}>
    {children}<CookieBanner />
  </CookieChimpProvider></body></html>;
}
`,
);
await writeFile(
  join(directory, "app/page.tsx"),
  `"use client";
import { useCategory } from "@cookiechimp/react";
import { GatedScript, CookiePreferences, RecallButton } from "@cookiechimp/react/ui";
import { useState } from "react";
export default function Page() {
  const allowed = useCategory("analytics");
  const [sibling, setSibling] = useState(false);
  return <main><h1>Packed SDK consumer</h1><p data-testid="state">{allowed ? "allowed" : "blocked"}</p>
    <button type="button" onClick={() => setSibling(value => !value)}>Toggle sibling</button>
    {sibling ? <p>Sibling inserted</p> : null}
    <GatedScript category="analytics">{"window.__packedRuns = (window.__packedRuns || 0) + 1;"}</GatedScript>
    <CookiePreferences categories={[{ id: "analytics", label: "Analytics" }]} /><RecallButton />
  </main>;
}
`,
);
await writeFile(
  join(directory, "next.config.mjs"),
  "export default { turbopack: { root: process.cwd() } };\n",
);
const next = require.resolve("next/dist/bin/next");
execFileSync(process.execPath, [next, "build"], {
  cwd: directory,
  stdio: "inherit",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});
const probe = createServer();
await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
const address = probe.address();
if (typeof address !== "object" || !address)
  throw new Error("Missing local port");
const port = address.port;
await new Promise<void>((done) => probe.close(() => done()));
const server = spawn(
  process.execPath,
  [next, "start", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: directory,
    stdio: "pipe",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  },
);
const url = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
try {
  const deadline = Date.now() + 20000;
  while (true) {
    if (server.exitCode !== null) throw new Error("Consumer server exited");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch {}
    if (Date.now() > deadline)
      throw new Error("Consumer server did not become ready");
    await new Promise((done) => setTimeout(done, 100));
  }
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  const banner = page.locator('[data-cc-part="banner"]');
  await expect(banner).toBeVisible();
  expect(
    await banner.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
  const runs = () =>
    page.evaluate(
      () => (window as typeof window & { __packedRuns?: number }).__packedRuns,
    );
  expect(await runs()).toBeUndefined();
  await page.getByRole("button", { name: "Accept all cookies" }).click();
  await expect(page.getByTestId("state")).toHaveText("allowed");
  await expect.poll(runs).toBe(1);
  await page.getByRole("button", { name: "Toggle sibling" }).click();
  await expect(page.getByText("Sibling inserted")).toBeVisible();
  await page.getByRole("button", { name: "Toggle sibling" }).click();
  await expect(page.getByText("Sibling inserted")).toHaveCount(0);
  expect(await runs()).toBe(1);
  await page.reload();
  await expect(banner).toHaveCount(0);
  await expect(page.getByTestId("state")).toHaveText("allowed");
  await expect.poll(runs).toBe(1);
  await page.locator('[data-cc-part="recall"]').click();
  await expect(
    page.getByRole("dialog", { name: "Cookie preferences" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: join(directory, "verified.png"),
    fullPage: true,
  });
  await writeFile(
    join(artifacts, "consumer-validation.json"),
    JSON.stringify(
      {
        version: "1.0.0",
        packageCount: manifest.packages.length,
        checkedExports: count,
        browser: browser.version(),
        types: "passed",
        esmAndCjs: "passed",
        nextjsProductionBuild: "passed",
        consentAndPersistence: "passed",
        reactReconciliation: "passed",
        css: "passed",
      },
      null,
      2,
    ),
  );
  console.log(
    `Packed consumer verified ${count} exports, ${manifest.packages.length} packages and the browser flow`,
  );
} finally {
  await browser.close();
  server.kill("SIGTERM");
}

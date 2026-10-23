import { execFileSync, spawn } from "node:child_process";
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { releaseVersion, validateManifest } from "./manifest.ts";

const directory = resolve(import.meta.dirname, "consumer");
const artifacts = resolve(import.meta.dirname, "artifacts");
const manifest = JSON.parse(
  await readFile(join(artifacts, "manifest.json"), "utf8"),
);
validateManifest(
  manifest,
  releaseVersion,
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
);
await rm(directory, { recursive: true, force: true });
await mkdir(join(directory, "app"), { recursive: true });
const dependencies: Record<string, string> = {
  next: "16.4.3",
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
  if (packed.version !== manifest.version)
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
import "@cookiechimp/react/tcf.css";
import { CookieChimpProvider, TcfStub } from "@cookiechimp/nextjs/server";
import { CookieBanner } from "@cookiechimp/react/banner";
import type { ReactNode } from "react";
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><head><TcfStub nonce="consumer-fixture" /></head><body><CookieChimpProvider config={{ categories: { analytics: false }, regulation: "gdpr" }}>
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
import { TcfProvider } from "@cookiechimp/react/tcf-provider";
import { TcfVendorList } from "@cookiechimp/react/tcf";
import { useState } from "react";
// Fixture-only CMP ID and vendor data, never production registration.
const tcf = { cmpId: 123, gvl: {
  vendorListVersion: 151, tcfPolicyVersion: 5,
  standardTexts: { features: "Packed feature explanation." },
  purposes: { "1": { name: "Packed purpose", description: "Packed purpose disclosure.", illustrations: ["Packed purpose example."] } },
  features: { "1": { name: "Packed ordinary feature", description: "Packed feature disclosure.", illustrations: ["Packed feature example."] } },
  vendors: { "1": { id: 1, name: "Packed fixture vendor", purposes: [1, 8], legIntPurposes: [], specialFeatures: [], features: [1] } }
} };
export default function Page() {
  const allowed = useCategory("analytics");
  const [sibling, setSibling] = useState(false);
  const [tcfEnabled, setTcfEnabled] = useState(true);
  return <main><h1>Packed SDK consumer</h1><p data-testid="state">{allowed ? "allowed" : "blocked"}</p>
    <button type="button" onClick={() => setSibling(value => !value)}>Toggle sibling</button>
    {sibling ? <p>Sibling inserted</p> : null}
    <GatedScript category="analytics">{"window.__packedRuns = (window.__packedRuns || 0) + 1;"}</GatedScript>
    <TcfProvider enabled={tcfEnabled} options={tcf}>{({controller, status}) => <>
      <p data-testid="tcf-status">{status}</p>
      <CookiePreferences categories={[{ id: "analytics", label: "Analytics" }]}>
        {controller ? <TcfVendorList controller={controller} /> : null}
      </CookiePreferences>
    </>}</TcfProvider>
    <button type="button" onClick={() => setTcfEnabled(false)}>Disable TCF</button><RecallButton />
  </main>;
}
`,
);
await writeFile(
  join(directory, "next.config.mjs"),
  "export default { turbopack: { root: process.cwd() } };\n",
);
await mkdir(join(directory, "app/platform"), { recursive: true });
await writeFile(
  join(directory, "app/platform/bundle.json"),
  await readFile(
    resolve(
      import.meta.dirname,
      "../packages/core/src/fixtures/platform-offline-bundle.json",
    ),
    "utf8",
  ),
);
await writeFile(
  join(directory, "app/platform/page.tsx"),
  `import { getServerConsent } from "@cookiechimp/nextjs/server";
import { Experience } from "./experience";
export default async function Page() {
  return <Experience initialState={await getServerConsent({cookieName:"cc_packed_platform"})} />;
}
`,
);
await writeFile(
  join(directory, "app/platform/experience.tsx"),
  `"use client";
import type { ConsentState } from "@cookiechimp/core";
import { PlatformConsentProvider, CookieBanner, CookiePreferences, RecallButton } from "@cookiechimp/react/platform";
import "@cookiechimp/react/platform.css";
import { useConsent } from "@cookiechimp/react";
import bundle from "./bundle.json";
function State() { return <output data-testid="platform-state">{JSON.stringify(useConsent().services)}</output>; }
export function Experience({initialState}: {initialState: ConsentState | null}) {
  return <PlatformConsentProvider bundle={bundle} region="IE" locale="en" initialState={initialState} cookie={{name:"cc_packed_platform"}}>
    <h1>Packed platform UI</h1><State /><CookieBanner /><CookiePreferences /><RecallButton />
  </PlatformConsentProvider>;
}
`,
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
  await expect(page.getByTestId("tcf-status")).toHaveText("ready");
  const tcfData = () =>
    page.evaluate(
      () =>
        new Promise<{ vendor: { consents: Record<string, boolean> } }>(
          (resolve) => {
            (
              window as typeof window & {
                __tcfapi: (
                  command: string,
                  version: number,
                  callback: (data: {
                    vendor: { consents: Record<string, boolean> };
                  }) => void,
                ) => void;
              }
            ).__tcfapi("addEventListener", 2, resolve);
          },
        ),
    );
  expect((await tcfData()).vendor.consents["1"]).not.toBe(true);
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
  expect((await tcfData()).vendor.consents["1"]).toBe(true);
  await page.getByRole("button", { name: "Toggle sibling" }).click();
  await expect(page.getByText("Sibling inserted")).toBeVisible();
  await page.getByRole("button", { name: "Toggle sibling" }).click();
  await expect(page.getByText("Sibling inserted")).toHaveCount(0);
  expect(await runs()).toBe(1);
  await page.reload();
  await expect(page.getByTestId("tcf-status")).toHaveText("ready");
  expect((await tcfData()).vendor.consents["1"]).toBe(true);
  await expect(banner).toHaveCount(0);
  await expect(page.getByTestId("state")).toHaveText("allowed");
  await expect.poll(runs).toBe(1);
  await page.locator('[data-cc-part="recall"]').click();
  await expect(
    page.getByRole("dialog", { name: "Cookie preferences" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Partners and purposes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Consent: Packed fixture vendor",
      exact: true,
    }),
  ).toBeChecked();
  const purpose = page.locator("summary").filter({ hasText: "Packed purpose" });
  await purpose.click();
  await expect(
    page.getByText("Packed purpose disclosure.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Packed purpose example.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Details: Packed fixture vendor",
      exact: true,
    })
    .click();
  const panel = page.getByRole("region", {
    name: "Packed fixture vendor",
    exact: true,
  });
  await expect(
    panel.getByText("Packed feature explanation.", { exact: true }),
  ).toBeVisible();
  await panel
    .locator("summary")
    .filter({ hasText: "Packed ordinary feature" })
    .click();
  await expect(
    panel.getByText("Packed feature disclosure.", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("Packed feature example.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({
    path: join(directory, "verified.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Disable TCF" }).click();
  await expect(page.getByTestId("tcf-status")).toHaveText("disabled");
  expect(
    await page.evaluate(
      () => typeof (window as typeof window & { __tcfapi?: unknown }).__tcfapi,
    ),
  ).toBe("undefined");
  expect(errors).toEqual([]);
  await page.goto(`${url}/platform`);
  const platform = page.locator("[data-cc-platform]");
  await expect(platform.locator('[data-cc-part="banner"]')).toBeVisible();
  await platform
    .getByRole("button", { name: "Manage Preferences", exact: true })
    .click();
  const platformDialog = platform.getByRole("dialog", {
    name: "Cookie Settings",
  });
  await expect(platformDialog).toBeVisible();
  const consentId = platformDialog.locator(
    '[data-cc-part="preferences-consent-id"]',
  );
  const originalId = await consentId.innerText();
  expect(originalId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  await expect(
    platformDialog.getByRole("switch", { name: "Essential", exact: true }),
  ).toBeDisabled();
  await platformDialog
    .getByRole("button", { name: "Analytics", exact: true })
    .click();
  await platformDialog
    .getByRole("button", { name: "Google Analytics", exact: true })
    .click();
  await expect(platformDialog.getByText("_ga", { exact: true })).toBeVisible();
  await platformDialog
    .getByRole("switch", { name: "Google Analytics", exact: true })
    .click();
  await platformDialog
    .getByRole("button", { name: "Save Preferences", exact: true })
    .click();
  await page.reload();
  await expect(platform.locator('[data-cc-part="banner"]')).toHaveCount(0);
  await platform.locator('[data-cc-part="recall"]').click();
  await expect(consentId).toHaveText(originalId);
  await platformDialog
    .getByRole("button", { name: "Analytics", exact: true })
    .click();
  await expect(
    platformDialog.getByRole("switch", {
      name: "Google Analytics",
      exact: true,
    }),
  ).toHaveAttribute("aria-checked", "true");
  await platformDialog
    .getByRole("button", { name: "Reject All", exact: true })
    .click();
  await page.reload();
  await platform.locator('[data-cc-part="recall"]').click();
  await platformDialog
    .getByRole("button", { name: "Analytics", exact: true })
    .click();
  await expect(
    platformDialog.getByRole("switch", {
      name: "Google Analytics",
      exact: true,
    }),
  ).toHaveAttribute("aria-checked", "false");
  await page.screenshot({
    path: join(directory, "platform-verified.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await writeFile(
    join(artifacts, "consumer-validation.json"),
    JSON.stringify(
      {
        version: manifest.version,
        sourceCommit: manifest.sourceCommit,
        packageCount: manifest.packages.length,
        checkedExports: count,
        browser: browser.version(),
        types: "passed",
        esmAndCjs: "passed",
        nextjsProductionBuild: "passed",
        consentAndPersistence: "passed",
        reactReconciliation: "passed",
        tcfProvider: "passed",
        gvlDisclosures: "passed",
        css: "passed",
        platformVendorChoicesAndPersistence: "passed",
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

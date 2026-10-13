// @vitest-environment happy-dom
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, expect, it, vi } from "vitest";
import { scaffold } from "./templates";

// Generated files are written inside this package so their imports resolve
// to the workspace packages, then imported and rendered for real.
const out = resolve(__dirname, "../.scaffold-test");
afterEach(() => {
  document.body.replaceChildren();
  // biome-ignore lint/suspicious/noDocumentCookie: resets the consent cookie between tests
  document.cookie = "cc_consent=; Max-Age=0; Path=/";
  vi.restoreAllMocks();
});
afterAll(() => rmSync(out, { recursive: true, force: true }));

function write(name: string, framework: Parameters<typeof scaffold>[0]) {
  const dir = join(out, name);
  for (const file of scaffold(framework, "").files) {
    mkdirSync(join(dir, file.path, ".."), { recursive: true });
    writeFileSync(join(dir, file.path), file.content);
  }
  return dir;
}

it("the React scaffold renders the banner and starts no request", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  const dir = write("react", "react");
  const { CookieChimp } = (await import(
    /* @vite-ignore */ join(dir, "components/cookiechimp-provider.tsx")
  )) as { CookieChimp: (props: { children: ReactNode }) => ReactNode };
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <CookieChimp>
        <p>app</p>
      </CookieChimp>,
    ),
  );
  expect(host.textContent).toContain("app");
  const accept = [...host.querySelectorAll("button")].find((button) =>
    /accept/i.test(button.textContent ?? ""),
  );
  expect(accept).toBeDefined();
  await act(async () => accept?.click());
  expect(document.cookie).toContain("cc_consent=");
  expect(fetchSpy).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it("the Next.js banner scaffold renders inside a provider", async () => {
  const dir = write("next", "next-app");
  const { CookieChimpBanner } = (await import(
    /* @vite-ignore */ join(dir, "components/cookiechimp-banner.tsx")
  )) as { CookieChimpBanner: () => ReactNode };
  const { consentConfig } = await import(
    /* @vite-ignore */ join(dir, "cookiechimp.config.ts")
  );
  const { ConsentProvider } = await import("@cookiechimp/react");
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ConsentProvider config={consentConfig}>
        <CookieChimpBanner />
      </ConsentProvider>,
    ),
  );
  expect(host.querySelectorAll("button").length).toBeGreaterThan(0);
  await act(async () => root.unmount());
});

it("the vanilla scaffold keeps gated scripts blocked until consent", async () => {
  const script = document.createElement("script");
  script.type = "text/plain";
  script.setAttribute("data-cc-src", "https://cdn.example.test/a.js");
  script.setAttribute("data-cc-category", "analytics");
  document.head.append(script);
  const dir = write("vanilla", "vanilla");
  const { consent, gate } = await import(
    /* @vite-ignore */ join(dir, "cookiechimp.ts")
  );
  expect(script.getAttribute("src")).toBeNull();
  expect(gate.blocked()).toHaveLength(1);
  expect(consent.get().categories.necessary).toBe(true);
  gate.stop();
  script.remove();
});

it.each(["react", "next-app", "next-pages", "vanilla"] as const)(
  "the %s scaffold passes TypeScript against the actual package types",
  (framework) => {
    const dir = write(`typed-${framework}`, framework);
    // Next.js and Vite supply stylesheet declarations in the target app.
    writeFileSync(join(dir, "styles.d.ts"), 'declare module "*.css";\n');
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        extends: resolve(__dirname, "../../../tsconfig.base.json"),
        compilerOptions: { jsx: "react-jsx" },
        include: ["**/*.ts", "**/*.tsx"],
      }),
    );
    const result = spawnSync(
      resolve(__dirname, "../node_modules/.bin/tsc"),
      ["--noEmit", "--project", join(dir, "tsconfig.json")],
      { encoding: "utf8" },
    );
    expect(result.error).toBeUndefined();
    expect(result.stdout + result.stderr).toBe("");
    expect(result.status).toBe(0);
  },
);

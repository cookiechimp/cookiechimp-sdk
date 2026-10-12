import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

describe("built core entry points", () => {
  const dist = resolve(import.meta.dirname, "../dist");
  const indexPath = resolve(dist, "index.mjs");
  const buildAvailable = existsSync(indexPath);

  it.skipIf(!buildAvailable)(
    buildAvailable
      ? "keeps optional sync and matching code out of the default entry"
      : "skipped because packages/core/dist/index.mjs is missing, run pnpm build",
    () => {
      const index = readFileSync(indexPath, "utf8");
      const sync = readFileSync(resolve(dist, "sync.mjs"), "utf8");
      const match = readFileSync(resolve(dist, "match.mjs"), "utf8");
      const regions = readFileSync(resolve(dist, "regions.mjs"), "utf8");
      const gate = readFileSync(resolve(dist, "gate.mjs"), "utf8");
      const dynamic = readFileSync(resolve(dist, "dynamic.mjs"), "utf8");
      const consentMode = readFileSync(
        resolve(dist, "consent-mode.mjs"),
        "utf8",
      );
      const network = readFileSync(resolve(dist, "network.mjs"), "utf8");

      for (const identifier of [
        "mergeConfig",
        "categoriesHash",
        "matchService",
      ]) {
        expect(index, `index.mjs contains ${identifier}`).not.toContain(
          identifier,
        );
      }
      expect(sync).toContain("mergeConfig");
      expect(sync).toContain("categoriesHash");
      expect(match).toContain("matchService");
      expect(index).not.toContain("gateScripts");
      expect(index).not.toContain("data-cc-blocked");
      expect(index).not.toContain("blockDynamic");
      expect(index).not.toContain("blockNetwork");
      expect(index).not.toContain("ConsentBlockedError");
      expect(gate).toContain("gateScripts");
      expect(gate).toContain("data-cc-blocked");
      expect(dynamic).toContain("blockDynamic");
      expect(dynamic).toContain("insertAdjacentHTML");
      expect(index).not.toContain("installConsentMode");
      expect(index).not.toContain("wait_for_update");
      expect(consentMode).toContain("installConsentMode");
      expect(consentMode).toContain("wait_for_update");
      expect(network).toContain("blockNetwork");
      expect(network).toContain("ConsentBlockedError");
      for (const token of [
        "x-vercel-ip-country",
        "cf-ipcountry",
        "AT BE BG HR CY CZ DE",
        "CA CO CT DE IA IN KY",
      ]) {
        expect(index, `index.mjs contains ${token}`).not.toContain(token);
        expect(regions, `regions.mjs omits ${token}`).toContain(token);
      }
    },
  );

  it.skipIf(!buildAvailable)(
    buildAvailable
      ? "preserves runtime development detection in the default entry"
      : "skipped because packages/core/dist/index.mjs is missing, run pnpm build",
    () => {
      const index = readFileSync(indexPath, "utf8");
      const imports = [...index.matchAll(/from["']\.\/(.+?\.mjs)["']/g)].map(
        ([, file]) => readFileSync(resolve(dist, file as string), "utf8"),
      );
      const defaultEntry = [index, ...imports].join("\n");

      expect(defaultEntry).toContain("typeof process");
      expect(defaultEntry).toContain("process.env.NODE_ENV");
      expect(defaultEntry).toContain("production");
    },
  );

  it.skipIf(!buildAvailable)(
    buildAvailable
      ? "uses a safe production fallback without process and throws in development"
      : "skipped because packages/core/dist/index.mjs is missing, run pnpm build",
    () => {
      const moduleUrl = pathToFileURL(indexPath).href;
      const withoutProcess = `
        const moduleUrl = process.argv[1];
        globalThis.process = undefined;
        const { normalizeConfig } = await import(moduleUrl);
        normalizeConfig({ categories: ["Invalid"] });
        console.log("production fallback");
      `;
      expect(
        execFileSync(
          process.execPath,
          ["--input-type=module", "-e", withoutProcess, moduleUrl],
          {
            encoding: "utf8",
          },
        ),
      ).toContain("production fallback");

      const inDevelopment = `
        const { normalizeConfig, ConsentConfigError } = await import(process.argv[1]);
        try {
          normalizeConfig({ categories: ["Invalid"] });
        } catch (error) {
          if (error instanceof ConsentConfigError) process.exit(0);
          throw error;
        }
        process.exit(1);
      `;
      expect(() =>
        execFileSync(
          process.execPath,
          ["--input-type=module", "-e", inDevelopment, moduleUrl],
          {
            env: { ...process.env, NODE_ENV: "development" },
            stdio: "pipe",
          },
        ),
      ).not.toThrow();
    },
  );
});

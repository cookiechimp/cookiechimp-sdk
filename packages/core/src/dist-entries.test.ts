import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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
});

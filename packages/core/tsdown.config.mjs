import { defineConfig } from "tsdown";

const shared = {
  dts: true,
  format: ["esm", "cjs"],
  minify: true,
  sourcemap: true,
};

export default defineConfig([
  { ...shared, entry: ["src/index.ts"] },
  {
    ...shared,
    entry: [
      "src/sync.ts",
      "src/consent-log.ts",
      "src/endpoint.ts",
      "src/match.ts",
      "src/regions.ts",
      "src/gate.ts",
      "src/consent-mode.ts",
      "src/language.ts",
    ],
    clean: false,
  },
  { ...shared, entry: ["src/dynamic.ts"], clean: false },
  { ...shared, entry: ["src/network.ts"], clean: false },
]);

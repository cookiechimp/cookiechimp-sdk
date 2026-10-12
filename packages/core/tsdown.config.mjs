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
      "src/match.ts",
      "src/regions.ts",
      "src/gate.ts",
      "src/dynamic.ts",
      "src/network.ts",
      "src/consent-mode.ts",
    ],
    clean: false,
  },
]);

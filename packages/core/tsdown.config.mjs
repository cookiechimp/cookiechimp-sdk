import { defineConfig } from "tsdown";

const shared = {
  dts: true,
  format: ["esm", "cjs"],
  minify: true,
  sourcemap: true,
};

export default defineConfig([
  {
    ...shared,
    // Share config normalization with sync while keeping opt-in entries separate.
    entry: [
      "src/index.ts",
      "src/sync.ts",
      "src/consent-log.ts",
      "src/endpoint.ts",
      "src/match.ts",
      "src/regions.ts",
      "src/gate.ts",
      "src/consent-mode.ts",
      "src/language.ts",
    ],
  },
  { ...shared, entry: ["src/dynamic.ts"], clean: false },
  { ...shared, entry: ["src/network.ts"], clean: false },
  { ...shared, entry: ["src/gpp.ts"], clean: false },
  { ...shared, entry: ["src/gpp-stub.ts"], clean: false },
  { ...shared, entry: ["src/tcf.ts"], clean: false },
  { ...shared, entry: ["src/tcf-stub.ts"], clean: false },
]);

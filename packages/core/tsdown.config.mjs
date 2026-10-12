import { defineConfig } from "tsdown";

export default defineConfig({
  dts: true,
  entry: ["src/index.ts", "src/sync.ts", "src/match.ts"],
  format: ["esm", "cjs"],
  minify: true,
  sourcemap: true,
});

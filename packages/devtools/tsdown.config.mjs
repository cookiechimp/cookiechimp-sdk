import { defineConfig } from "tsdown";
export default defineConfig({
  entry: ["src/index.ts", "src/simulation.ts"],
  format: ["esm", "cjs"],
  dts: true,
  minify: true,
  sourcemap: true,
});

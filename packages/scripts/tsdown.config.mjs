import { defineConfig } from "tsdown";
export default defineConfig({
  entry: ["src/index.ts", "src/ga4.ts", "src/gtm.ts", "src/google-ads.ts"],
  format: ["esm", "cjs"],
  dts: true,
  minify: true,
  sourcemap: true,
});
